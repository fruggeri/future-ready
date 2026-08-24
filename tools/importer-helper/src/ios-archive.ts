import fs from "node:fs";
import path from "node:path";

import { IOS_ARCHIVE_PATH } from "./config";
import type { ImporterDatabase } from "./database";
import type { AgendaItemPayload, MeetingPayload } from "./types";

type IOSAttachment = {
  id: string;
  name: string;
  url: string;
  kind: string;
};

type IOSAgendaItem = {
  id: string;
  title: string;
  level: number;
  body: string | null;
  attachments: IOSAttachment[];
  children: IOSAgendaItem[];
};

type IOSMeeting = {
  id: string;
  title: string;
  date: string;
  time: string;
  type: string;
  location: string;
  detailURL: string;
  minutesText: string | null;
  minutesURL: string | null;
  agenda: IOSAgendaItem[];
};

type IOSBoardArchive = {
  generatedAt: string;
  sourceURL: string;
  district: { id: string; name: string };
  meetings: IOSMeeting[];
};

function safeId(value: string) {
  return value.replace(/=+$/g, "").replace(/[^A-Za-z0-9_-]+/g, "_").slice(0, 160);
}

function parseDateLabel(value: string | null) {
  const match = value?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*-\s*(\d{1,2}:\d{2}\s*[AP]M))?/i);
  if (!match) return { date: "", time: "" };
  const [, month, day, year, time = ""] = match;
  return {
    date: `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`,
    time: time.toUpperCase().replace(/^(\d):/, "0$1:"),
  };
}

function attachmentKind(name: string) {
  return /minutes?/i.test(name) ? "minutes" : "link";
}

function buildAgenda(items: AgendaItemPayload[]) {
  const nodes = new Map<string, IOSAgendaItem>();
  const sourceIds = new Map<string, string>();

  for (const item of items) {
    const id = safeId(item.itemId);
    sourceIds.set(item.itemId, id);
    nodes.set(id, {
      id,
      title: item.title,
      level: Math.max(1, item.level + 1),
      body: item.plainText.trim() || null,
      attachments: item.supportingDocuments.map((attachment) => ({
        id: safeId(attachment.attachmentId),
        name: attachment.fileName.trim() || "Supporting document",
        url: attachment.sourceUrl,
        kind: attachmentKind(attachment.fileName),
      })),
      children: [],
    });
  }

  const roots: IOSAgendaItem[] = [];
  for (const item of items) {
    const node = nodes.get(sourceIds.get(item.itemId) ?? "");
    if (!node) continue;
    const parentId = item.parentItemId ? sourceIds.get(item.parentItemId) : null;
    const parent = parentId ? nodes.get(parentId) : null;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  return roots;
}

function toIOSMeeting(meeting: MeetingPayload): IOSMeeting {
  const { date, time } = parseDateLabel(meeting.meetingDateLabel);
  const agenda = buildAgenda(meeting.items);
  const minuteAttachments = meeting.items.flatMap((item) =>
    item.supportingDocuments
      .filter((attachment) => attachmentKind(attachment.fileName) === "minutes")
      .map((attachment) => ({ attachment, body: item.plainText.trim() })),
  );
  const firstMinutes = minuteAttachments[0];
  const title = meeting.meetingTitle.split(/\s*\|\s*\d{1,2}\/\d{1,2}\/\d{4}/, 1)[0]?.trim() || meeting.meetingTitle;

  return {
    id: meeting.meetingId,
    title,
    date,
    time,
    type: "Board Meeting",
    location: "Miller Creek School District",
    detailURL: meeting.sourceUrl,
    minutesText: firstMinutes?.body || null,
    minutesURL: firstMinutes?.attachment.sourceUrl || null,
    agenda,
  };
}

function readArchive(archivePath: string): IOSBoardArchive {
  const parsed = JSON.parse(fs.readFileSync(archivePath, "utf8")) as IOSBoardArchive;
  if (!Array.isArray(parsed.meetings) || !parsed.district) {
    throw new Error(`The iOS archive at ${archivePath} has an unexpected format.`);
  }
  return parsed;
}

export function publishIOSArchive(db: ImporterDatabase, meetingIds?: string[]) {
  if (!IOS_ARCHIVE_PATH) return null;
  if (!fs.existsSync(IOS_ARCHIVE_PATH)) {
    throw new Error(`The iOS archive does not exist: ${IOS_ARCHIVE_PATH}`);
  }

  const archive = readArchive(IOS_ARCHIVE_PATH);
  const meetingsById = new Map(archive.meetings.map((meeting) => [meeting.id, meeting]));
  const ids = meetingIds ?? db.getMeetingIds();
  for (const meetingId of ids) {
    meetingsById.set(meetingId, toIOSMeeting(db.getMeetingPayload(meetingId, false)));
  }

  archive.generatedAt = new Date().toISOString();
  archive.meetings = Array.from(meetingsById.values()).sort((left, right) => {
    const dateOrder = right.date.localeCompare(left.date);
    return dateOrder || right.id.localeCompare(left.id);
  });

  const directory = path.dirname(IOS_ARCHIVE_PATH);
  const temporaryPath = path.join(directory, `.${path.basename(IOS_ARCHIVE_PATH)}.${process.pid}.tmp`);
  fs.writeFileSync(temporaryPath, `${JSON.stringify(archive, null, 2)}\n`, "utf8");
  fs.renameSync(temporaryPath, IOS_ARCHIVE_PATH);

  return { path: IOS_ARCHIVE_PATH, meetingCount: archive.meetings.length, publishedMeetingIds: ids };
}
