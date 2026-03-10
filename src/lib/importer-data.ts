import "server-only";

import Database from "better-sqlite3";

import { ARCHIVE_DB_PATH } from "@/lib/archive-config";

type MeetingRow = {
  meeting_id: string;
  district_id: string | null;
  source_url: string;
  meeting_title: string;
  meeting_date_label: string | null;
  agenda_tab_label: string | null;
  last_imported_at: string;
};

type AgendaItemRow = {
  item_id: string;
  meeting_id: string;
  parent_item_id: string | null;
  title: string;
  order_index: number;
  level: number;
  path_json: string;
  raw_html: string;
  plain_text: string;
  updated_at: string;
};

type AttachmentRow = {
  attachment_key: string;
  attachment_id: string;
  item_id: string;
  meeting_id: string;
  file_name: string;
  source_url: string;
  local_path: string;
  mime_type: string;
  size_bytes: number;
  sha256: string;
  downloaded_at: string;
};

export type ImportedAttachment = {
  attachmentKey: string;
  attachmentId: string;
  fileName: string;
  sourceUrl: string;
  localPath: string;
  mimeType: string;
  sizeBytes: number;
  downloadedAt: string;
};

export type ImportedAgendaItem = {
  itemId: string;
  parentItemId: string | null;
  meetingId: string;
  title: string;
  orderIndex: number;
  level: number;
  path: string[];
  rawHtml: string;
  plainText: string;
  updatedAt: string;
  attachments: ImportedAttachment[];
};

export type ImportedMeeting = {
  meetingId: string;
  districtId: string | null;
  sourceUrl: string;
  meetingTitle: string;
  meetingDateLabel: string | null;
  agendaTabLabel: string | null;
  lastImportedAt: string;
  itemCount: number;
  attachmentCount: number;
};

export type ImportedMeetingDetail = ImportedMeeting & {
  items: ImportedAgendaItem[];
};

function parseMeetingDateLabel(value: string | null) {
  if (!value) {
    return 0;
  }

  const match = value.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)$/i,
  );
  if (!match) {
    const fallback = new Date(value).getTime();
    return Number.isNaN(fallback) ? 0 : fallback;
  }

  const [, month, day, year, hour, minute, meridiem] = match;
  let hour24 = Number(hour) % 12;
  if (meridiem.toUpperCase() === "PM") {
    hour24 += 12;
  }

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    hour24,
    Number(minute),
  ).getTime();
}

function getDb() {
  return new Database(ARCHIVE_DB_PATH, {
    readonly: true,
    fileMustExist: true,
  });
}

export function getImportedMeetings(): ImportedMeeting[] {
  const db = getDb();
  const rows = db
    .prepare(
      `
      SELECT
        m.meeting_id,
        m.district_id,
        m.source_url,
        m.meeting_title,
        m.meeting_date_label,
        m.agenda_tab_label,
        m.last_imported_at,
        COUNT(DISTINCT ai.item_id) AS item_count,
        COUNT(DISTINCT at.attachment_key) AS attachment_count
      FROM meetings m
      LEFT JOIN agenda_items ai ON ai.meeting_id = m.meeting_id
      LEFT JOIN attachments at ON at.meeting_id = m.meeting_id
      GROUP BY m.meeting_id
      ORDER BY datetime(m.last_imported_at) DESC
    `,
    )
    .all() as Array<MeetingRow & { item_count: number; attachment_count: number }>;
  db.close();

  return rows
    .map((row) => ({
      meetingId: row.meeting_id,
      districtId: row.district_id,
      sourceUrl: row.source_url,
      meetingTitle: row.meeting_title,
      meetingDateLabel: row.meeting_date_label,
      agendaTabLabel: row.agenda_tab_label,
      lastImportedAt: row.last_imported_at,
      itemCount: row.item_count,
      attachmentCount: row.attachment_count,
    }))
    .sort((left, right) => parseMeetingDateLabel(right.meetingDateLabel) - parseMeetingDateLabel(left.meetingDateLabel));
}

export function getImportedMeetingDetail(meetingId: string): ImportedMeetingDetail | null {
  const db = getDb();
  const meetingRow = db
    .prepare(
      `
      SELECT
        m.meeting_id,
        m.district_id,
        m.source_url,
        m.meeting_title,
        m.meeting_date_label,
        m.agenda_tab_label,
        m.last_imported_at,
        COUNT(DISTINCT ai.item_id) AS item_count,
        COUNT(DISTINCT at.attachment_key) AS attachment_count
      FROM meetings m
      LEFT JOIN agenda_items ai ON ai.meeting_id = m.meeting_id
      LEFT JOIN attachments at ON at.meeting_id = m.meeting_id
      WHERE m.meeting_id = ?
      GROUP BY m.meeting_id
    `,
    )
    .get(meetingId) as (MeetingRow & { item_count: number; attachment_count: number }) | undefined;

  if (!meetingRow) {
    db.close();
    return null;
  }

  const itemRows = db
    .prepare(
      `
      SELECT item_id, meeting_id, parent_item_id, title, order_index, level, path_json, raw_html, plain_text, updated_at
      FROM agenda_items
      WHERE meeting_id = ?
      ORDER BY order_index ASC
    `,
    )
    .all(meetingId) as AgendaItemRow[];

  const attachmentRows = db
    .prepare(
      `
      SELECT attachment_key, attachment_id, item_id, meeting_id, file_name, source_url, local_path, mime_type, size_bytes, sha256, downloaded_at
      FROM attachments
      WHERE meeting_id = ?
      ORDER BY downloaded_at DESC, file_name ASC
    `,
    )
    .all(meetingId) as AttachmentRow[];

  db.close();

  const attachmentsByItem = new Map<string, ImportedAttachment[]>();
  for (const row of attachmentRows) {
    const current = attachmentsByItem.get(row.item_id) ?? [];
    current.push({
      attachmentKey: row.attachment_key,
      attachmentId: row.attachment_id,
      fileName: row.file_name,
      sourceUrl: row.source_url,
      localPath: row.local_path,
      mimeType: row.mime_type,
      sizeBytes: row.size_bytes,
      downloadedAt: row.downloaded_at,
    });
    attachmentsByItem.set(row.item_id, current);
  }

  return {
    meetingId: meetingRow.meeting_id,
    districtId: meetingRow.district_id,
    sourceUrl: meetingRow.source_url,
    meetingTitle: meetingRow.meeting_title,
    meetingDateLabel: meetingRow.meeting_date_label,
    agendaTabLabel: meetingRow.agenda_tab_label,
    lastImportedAt: meetingRow.last_imported_at,
    itemCount: meetingRow.item_count,
    attachmentCount: meetingRow.attachment_count,
    items: itemRows.map((row) => ({
      itemId: row.item_id,
      parentItemId: row.parent_item_id,
      meetingId: row.meeting_id,
      title: row.title,
      orderIndex: row.order_index,
      level: row.level,
      path: JSON.parse(row.path_json) as string[],
      rawHtml: row.raw_html,
      plainText: row.plain_text,
      updatedAt: row.updated_at,
      attachments: attachmentsByItem.get(row.item_id) ?? [],
    })),
  };
}
