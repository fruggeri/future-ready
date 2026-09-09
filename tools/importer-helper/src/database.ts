import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

import { extractAttachmentText } from "./attachment-text";
import { ATTACHMENTS_DIR, DB_PATH, LOGS_DIR } from "./config";
import type { AgendaItemPayload, FinishMeetingPayload, MeetingHeaderPayload, MeetingItemPayload, MeetingPayload } from "./types";

function ensureDirectories() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

function safeSegment(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "file";
}

export class ImporterDatabase {
  private db: Database.Database;

  constructor() {
    ensureDirectories();
    this.db = new Database(DB_PATH);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.initialize();
  }

  private initialize() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS imports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id TEXT NOT NULL,
        source_url TEXT NOT NULL,
        imported_at TEXT NOT NULL,
        item_count INTEGER NOT NULL,
        attachment_count INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS meetings (
        meeting_id TEXT PRIMARY KEY,
        district_id TEXT,
        source_url TEXT NOT NULL,
        meeting_title TEXT NOT NULL,
        meeting_date_label TEXT,
        agenda_tab_label TEXT,
        last_imported_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agenda_items (
        item_id TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL,
        parent_item_id TEXT,
        title TEXT NOT NULL,
        order_index INTEGER NOT NULL,
        level INTEGER NOT NULL,
        path_json TEXT NOT NULL,
        raw_html TEXT NOT NULL,
        plain_text TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS attachments (
        attachment_key TEXT PRIMARY KEY,
        attachment_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        meeting_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        local_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        downloaded_at TEXT NOT NULL,
        FOREIGN KEY(item_id) REFERENCES agenda_items(item_id) ON DELETE CASCADE,
        FOREIGN KEY(meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS attachment_content (
        attachment_key TEXT PRIMARY KEY,
        attachment_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        meeting_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        extracted_text TEXT NOT NULL,
        extraction_status TEXT NOT NULL,
        extracted_at TEXT NOT NULL,
        FOREIGN KEY(attachment_key) REFERENCES attachments(attachment_key) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_agenda_items_meeting_id ON agenda_items(meeting_id);
      CREATE INDEX IF NOT EXISTS idx_attachments_item_id ON attachments(item_id);
      CREATE INDEX IF NOT EXISTS idx_attachment_content_item_id ON attachment_content(item_id);

      CREATE TABLE IF NOT EXISTS meeting_sync_status (
        meeting_id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        last_attempted_at TEXT,
        synced_at TEXT,
        FOREIGN KEY(meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS agenda_items_fts USING fts5(
        item_id UNINDEXED,
        meeting_id UNINDEXED,
        title,
        plain_text,
        tokenize='porter unicode61'
      );

      CREATE VIRTUAL TABLE IF NOT EXISTS attachment_content_fts USING fts5(
        attachment_key UNINDEXED,
        attachment_id UNINDEXED,
        item_id UNINDEXED,
        meeting_id UNINDEXED,
        file_name,
        extracted_text,
        tokenize='porter unicode61'
      );
    `);

    this.migrateAttachmentsSchema();
    this.rebuildFtsIndexes();
  }

  private migrateAttachmentsSchema() {
    const columns = this.db.prepare("PRAGMA table_info(attachments)").all() as Array<{ name: string }>;
    const hasAttachmentKey = columns.some((column) => column.name === "attachment_key");
    if (columns.length === 0 || hasAttachmentKey) {
      return;
    }

    this.db.exec(`
      DROP TABLE IF EXISTS attachments;
      DROP TABLE IF EXISTS attachment_content;
      DROP TABLE IF EXISTS attachment_content_fts;

      CREATE TABLE attachments (
        attachment_key TEXT PRIMARY KEY,
        attachment_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        meeting_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        source_url TEXT NOT NULL,
        local_path TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        downloaded_at TEXT NOT NULL,
        FOREIGN KEY(item_id) REFERENCES agenda_items(item_id) ON DELETE CASCADE,
        FOREIGN KEY(meeting_id) REFERENCES meetings(meeting_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_attachments_item_id ON attachments(item_id);

      CREATE TABLE attachment_content (
        attachment_key TEXT PRIMARY KEY,
        attachment_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        meeting_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        extracted_text TEXT NOT NULL,
        extraction_status TEXT NOT NULL,
        extracted_at TEXT NOT NULL,
        FOREIGN KEY(attachment_key) REFERENCES attachments(attachment_key) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_attachment_content_item_id ON attachment_content(item_id);

      CREATE VIRTUAL TABLE IF NOT EXISTS attachment_content_fts USING fts5(
        attachment_key UNINDEXED,
        attachment_id UNINDEXED,
        item_id UNINDEXED,
        meeting_id UNINDEXED,
        file_name,
        extracted_text,
        content='',
        tokenize='porter unicode61'
      );
    `);
  }

  private rebuildFtsIndexes() {
    this.db.exec(`
      DROP TABLE IF EXISTS agenda_items_fts;
      CREATE VIRTUAL TABLE agenda_items_fts USING fts5(
        item_id UNINDEXED,
        meeting_id UNINDEXED,
        title,
        plain_text,
        tokenize='porter unicode61'
      );

      INSERT INTO agenda_items_fts (item_id, meeting_id, title, plain_text)
      SELECT item_id, meeting_id, title, plain_text
      FROM agenda_items;
    `);

    const hasAttachmentContent = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'attachment_content'")
      .get() as { name: string } | undefined;

    if (hasAttachmentContent) {
      this.db.exec(`
        DROP TABLE IF EXISTS attachment_content_fts;
        CREATE VIRTUAL TABLE attachment_content_fts USING fts5(
          attachment_key UNINDEXED,
          attachment_id UNINDEXED,
          item_id UNINDEXED,
          meeting_id UNINDEXED,
          file_name,
          extracted_text,
          tokenize='porter unicode61'
        );

        INSERT INTO attachment_content_fts (
          attachment_key, attachment_id, item_id, meeting_id, file_name, extracted_text
        )
        SELECT attachment_key, attachment_id, item_id, meeting_id, file_name, extracted_text
        FROM attachment_content;
      `);
    }
  }

  private async buildAttachmentArtifacts(
    meetingId: string,
    item: AgendaItemPayload,
    timestamp: string,
    meetingFolder: string,
  ) {
    const itemFolder = path.join(meetingFolder, safeSegment(item.itemId));
    fs.mkdirSync(itemFolder, { recursive: true });

    const attachmentArtifacts: Array<{
      attachmentKey: string;
      attachmentId: string;
      itemId: string;
      meetingId: string;
      fileName: string;
      sourceUrl: string;
      localPath: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
      downloadedAt: string;
      extractedText: string;
      extractionStatus: "success" | "empty" | "unsupported" | "failed";
      extractedAt: string;
    }> = [];

    for (const attachment of item.supportingDocuments) {
      const attachmentKey = `${item.itemId}::${attachment.attachmentId}::${attachment.fileName}`;
      const filePath = path.join(itemFolder, `${safeSegment(attachment.attachmentId)}-${safeSegment(attachment.fileName)}`);
      const buffer = Buffer.from(attachment.base64Data, "base64");
      fs.writeFileSync(filePath, buffer);
      const extraction = await extractAttachmentText(attachment.fileName, attachment.mimeType, buffer);

      attachmentArtifacts.push({
        attachmentKey,
        attachmentId: attachment.attachmentId,
        itemId: item.itemId,
        meetingId,
        fileName: attachment.fileName,
        sourceUrl: attachment.sourceUrl,
        localPath: filePath,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        sha256: attachment.sha256,
        downloadedAt: timestamp,
        extractedText: extraction.extractedText,
        extractionStatus: extraction.extractionStatus,
        extractedAt: timestamp,
      });
    }

    return attachmentArtifacts;
  }

  getMeetingPayload(meetingId: string, includeAttachmentData = true): MeetingPayload {
    const meeting = this.db
      .prepare(
        `
        SELECT meeting_id, district_id, source_url, meeting_title, meeting_date_label, agenda_tab_label, last_imported_at
        FROM meetings
        WHERE meeting_id = ?
      `,
      )
      .get(meetingId) as
      | {
          meeting_id: string;
          district_id: string | null;
          source_url: string;
          meeting_title: string;
          meeting_date_label: string | null;
          agenda_tab_label: string | null;
          last_imported_at: string;
        }
      | undefined;

    if (!meeting) {
      throw new Error(`Meeting ${meetingId} was not found in the local archive.`);
    }

    const itemRows = this.db
      .prepare(
        `
        SELECT item_id, parent_item_id, title, order_index, level, path_json, raw_html, plain_text
        FROM agenda_items
        WHERE meeting_id = ?
        ORDER BY order_index ASC
      `,
      )
      .all(meetingId) as Array<{
      item_id: string;
      parent_item_id: string | null;
      title: string;
      order_index: number;
      level: number;
      path_json: string;
      raw_html: string;
      plain_text: string;
    }>;

    const attachmentRows = this.db
      .prepare(
        `
        SELECT attachment_id, item_id, file_name, source_url, local_path, mime_type, size_bytes, sha256
        FROM attachments
        WHERE meeting_id = ?
        ORDER BY downloaded_at ASC, file_name ASC
      `,
      )
      .all(meetingId) as Array<{
      attachment_id: string;
      item_id: string;
      file_name: string;
      source_url: string;
      local_path: string;
      mime_type: string;
      size_bytes: number;
      sha256: string;
    }>;

    const attachmentsByItem = new Map<string, AgendaItemPayload["supportingDocuments"]>();
    for (const attachment of attachmentRows) {
      if (includeAttachmentData && !fs.existsSync(attachment.local_path)) {
        throw new Error(`Local attachment is missing: ${attachment.file_name}`);
      }

      const current = attachmentsByItem.get(attachment.item_id) ?? [];
      current.push({
        attachmentId: attachment.attachment_id,
        fileName: attachment.file_name,
        sourceUrl: attachment.source_url,
        mimeType: attachment.mime_type,
        sizeBytes: attachment.size_bytes,
        sha256: attachment.sha256,
        base64Data: includeAttachmentData ? fs.readFileSync(attachment.local_path).toString("base64") : "",
      });
      attachmentsByItem.set(attachment.item_id, current);
    }

    return {
      importedAt: meeting.last_imported_at,
      sourceUrl: meeting.source_url,
      districtId: meeting.district_id,
      meetingId: meeting.meeting_id,
      meetingTitle: meeting.meeting_title,
      meetingDateLabel: meeting.meeting_date_label,
      agendaTabLabel: meeting.agenda_tab_label,
      items: itemRows.map((item) => ({
        itemId: item.item_id,
        parentItemId: item.parent_item_id,
        title: item.title,
        orderIndex: item.order_index,
        level: item.level,
        path: JSON.parse(item.path_json) as string[],
        rawHtml: item.raw_html,
        plainText: item.plain_text,
        supportingDocuments: attachmentsByItem.get(item.item_id) ?? [],
      })),
    };
  }

  getMeetingIds() {
    return (
      this.db
        .prepare(
          `
          SELECT meeting_id
          FROM meetings
          ORDER BY last_imported_at ASC, meeting_id ASC
        `,
        )
        .all() as Array<{ meeting_id: string }>
    ).map((row) => row.meeting_id);
  }

  queueMeetingSync(meetingId: string) {
    this.db
      .prepare(
        `
        INSERT INTO meeting_sync_status (meeting_id, status, attempts)
        VALUES (?, 'pending', 0)
        ON CONFLICT(meeting_id) DO UPDATE SET
          status = 'pending',
          last_error = NULL,
          synced_at = NULL
      `,
      )
      .run(meetingId);
  }

  getPendingMeetingIds() {
    return (
      this.db
        .prepare(
          `
          SELECT meeting_id
          FROM meeting_sync_status
          WHERE status IN ('pending', 'failed')
          ORDER BY COALESCE(last_attempted_at, '') ASC
        `,
        )
        .all() as Array<{ meeting_id: string }>
    ).map((row) => row.meeting_id);
  }

  markMeetingSyncSucceeded(meetingId: string) {
    const timestamp = new Date().toISOString();
    this.db
      .prepare(
        `
        UPDATE meeting_sync_status
        SET status = 'synced', attempts = attempts + 1, last_error = NULL, last_attempted_at = ?, synced_at = ?
        WHERE meeting_id = ?
      `,
      )
      .run(timestamp, timestamp, meetingId);
  }

  markMeetingSyncFailed(meetingId: string, message: string) {
    this.db
      .prepare(
        `
        UPDATE meeting_sync_status
        SET status = 'failed', attempts = attempts + 1, last_error = ?, last_attempted_at = ?
        WHERE meeting_id = ?
      `,
      )
      .run(message, new Date().toISOString(), meetingId);
  }

  prepareMeeting(header: MeetingHeaderPayload) {
    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `
          INSERT INTO meetings (
            meeting_id, district_id, source_url, meeting_title, meeting_date_label, agenda_tab_label, last_imported_at
          ) VALUES (
            @meetingId, @districtId, @sourceUrl, @meetingTitle, @meetingDateLabel, @agendaTabLabel, @importedAt
          )
          ON CONFLICT(meeting_id) DO UPDATE SET
            district_id = excluded.district_id,
            source_url = excluded.source_url,
            meeting_title = excluded.meeting_title,
            meeting_date_label = excluded.meeting_date_label,
            agenda_tab_label = excluded.agenda_tab_label,
            last_imported_at = excluded.last_imported_at
        `,
        )
        .run(header);

      this.db.prepare("DELETE FROM attachments WHERE meeting_id = ?").run(header.meetingId);
      this.db.prepare("DELETE FROM attachment_content WHERE meeting_id = ?").run(header.meetingId);
      this.db.prepare("DELETE FROM agenda_items WHERE meeting_id = ?").run(header.meetingId);
      this.db.prepare("DELETE FROM agenda_items_fts WHERE meeting_id = ?").run(header.meetingId);
      this.db.prepare("DELETE FROM attachment_content_fts WHERE meeting_id = ?").run(header.meetingId);
    });

    transaction();
  }

  async saveMeetingItem(payload: MeetingItemPayload) {
    const timestamp = payload.importedAt || new Date().toISOString();
    const meetingFolder = path.join(ATTACHMENTS_DIR, safeSegment(payload.meetingId));
    fs.mkdirSync(meetingFolder, { recursive: true });

    const attachmentArtifacts = await this.buildAttachmentArtifacts(
      payload.meetingId,
      payload.item,
      timestamp,
      meetingFolder,
    );

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `
          INSERT INTO agenda_items (
            item_id, meeting_id, parent_item_id, title, order_index, level, path_json, raw_html, plain_text, updated_at
          ) VALUES (
            @itemId, @meetingId, @parentItemId, @title, @orderIndex, @level, @pathJson, @rawHtml, @plainText, @updatedAt
          )
          ON CONFLICT(item_id) DO UPDATE SET
            meeting_id = excluded.meeting_id,
            parent_item_id = excluded.parent_item_id,
            title = excluded.title,
            order_index = excluded.order_index,
            level = excluded.level,
            path_json = excluded.path_json,
            raw_html = excluded.raw_html,
            plain_text = excluded.plain_text,
            updated_at = excluded.updated_at
        `,
        )
        .run({
          itemId: payload.item.itemId,
          meetingId: payload.meetingId,
          parentItemId: payload.item.parentItemId,
          title: payload.item.title,
          orderIndex: payload.item.orderIndex,
          level: payload.item.level,
          pathJson: JSON.stringify(payload.item.path),
          rawHtml: payload.item.rawHtml,
          plainText: payload.item.plainText,
          updatedAt: timestamp,
        });

      this.db
        .prepare("INSERT INTO agenda_items_fts (item_id, meeting_id, title, plain_text) VALUES (?, ?, ?, ?)")
        .run(payload.item.itemId, payload.meetingId, payload.item.title, payload.item.plainText);

      const upsertAttachment = this.db.prepare(`
        INSERT INTO attachments (
          attachment_key, attachment_id, item_id, meeting_id, file_name, source_url, local_path, mime_type, size_bytes, sha256, downloaded_at
        ) VALUES (
          @attachmentKey, @attachmentId, @itemId, @meetingId, @fileName, @sourceUrl, @localPath, @mimeType, @sizeBytes, @sha256, @downloadedAt
        )
      `);

      const upsertAttachmentContent = this.db.prepare(`
        INSERT INTO attachment_content (
          attachment_key, attachment_id, item_id, meeting_id, file_name, extracted_text, extraction_status, extracted_at
        ) VALUES (
          @attachmentKey, @attachmentId, @itemId, @meetingId, @fileName, @extractedText, @extractionStatus, @extractedAt
        )
      `);

      const upsertAttachmentFts = this.db.prepare(`
        INSERT INTO attachment_content_fts (
          attachment_key, attachment_id, item_id, meeting_id, file_name, extracted_text
        ) VALUES (
          @attachmentKey, @attachmentId, @itemId, @meetingId, @fileName, @extractedText
        )
      `);

      for (const attachment of attachmentArtifacts) {
        upsertAttachment.run(attachment);
        upsertAttachmentContent.run(attachment);
        upsertAttachmentFts.run(attachment);
      }
    });

    transaction();
    return {
      itemId: payload.item.itemId,
      attachmentCount: attachmentArtifacts.length,
    };
  }

  finishMeeting(payload: FinishMeetingPayload) {
    this.db
      .prepare(
        `
        INSERT INTO imports (
          meeting_id, source_url, imported_at, item_count, attachment_count
        ) VALUES (?, ?, ?, ?, ?)
      `,
      )
      .run(
        payload.meetingId,
        payload.sourceUrl,
        payload.importedAt,
        payload.itemCount,
        payload.attachmentCount,
      );

    const snapshotPath = path.join(LOGS_DIR, `${safeSegment(payload.meetingId)}-${Date.now()}.json`);
    fs.writeFileSync(snapshotPath, JSON.stringify(payload, null, 2));

    return {
      meetingId: payload.meetingId,
      itemCount: payload.itemCount,
      attachmentCount: payload.attachmentCount,
      snapshotPath,
    };
  }

  async saveMeeting(payload: MeetingPayload) {
    const timestamp = new Date().toISOString();
    const meetingFolder = path.join(ATTACHMENTS_DIR, safeSegment(payload.meetingId));
    fs.mkdirSync(meetingFolder, { recursive: true });

    const attachmentArtifacts: Array<{
      attachmentKey: string;
      attachmentId: string;
      itemId: string;
      meetingId: string;
      fileName: string;
      sourceUrl: string;
      localPath: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
      downloadedAt: string;
      extractedText: string;
      extractionStatus: "success" | "empty" | "unsupported" | "failed";
      extractedAt: string;
    }> = [];
    for (const item of payload.items) {
      const itemFolder = path.join(meetingFolder, safeSegment(item.itemId));
      fs.mkdirSync(itemFolder, { recursive: true });

      for (const attachment of item.supportingDocuments) {
        const attachmentKey = `${item.itemId}::${attachment.attachmentId}::${attachment.fileName}`;
        const filePath = path.join(itemFolder, `${safeSegment(attachment.attachmentId)}-${safeSegment(attachment.fileName)}`);
        const buffer = Buffer.from(attachment.base64Data, "base64");
        fs.writeFileSync(filePath, buffer);
        const extraction = await extractAttachmentText(attachment.fileName, attachment.mimeType, buffer);

        attachmentArtifacts.push({
          attachmentKey,
          attachmentId: attachment.attachmentId,
          itemId: item.itemId,
          meetingId: payload.meetingId,
          fileName: attachment.fileName,
          sourceUrl: attachment.sourceUrl,
          localPath: filePath,
          mimeType: attachment.mimeType,
          sizeBytes: attachment.sizeBytes,
          sha256: attachment.sha256,
          downloadedAt: timestamp,
          extractedText: extraction.extractedText,
          extractionStatus: extraction.extractionStatus,
          extractedAt: timestamp,
        });
      }
    }

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `
          INSERT INTO meetings (
            meeting_id, district_id, source_url, meeting_title, meeting_date_label, agenda_tab_label, last_imported_at
          ) VALUES (
            @meetingId, @districtId, @sourceUrl, @meetingTitle, @meetingDateLabel, @agendaTabLabel, @importedAt
          )
          ON CONFLICT(meeting_id) DO UPDATE SET
            district_id = excluded.district_id,
            source_url = excluded.source_url,
            meeting_title = excluded.meeting_title,
            meeting_date_label = excluded.meeting_date_label,
            agenda_tab_label = excluded.agenda_tab_label,
            last_imported_at = excluded.last_imported_at
        `,
        )
        .run(payload);

      this.db.prepare("DELETE FROM attachments WHERE meeting_id = ?").run(payload.meetingId);
      this.db.prepare("DELETE FROM attachment_content WHERE meeting_id = ?").run(payload.meetingId);
      this.db.prepare("DELETE FROM agenda_items WHERE meeting_id = ?").run(payload.meetingId);
      this.db.prepare("DELETE FROM agenda_items_fts WHERE meeting_id = ?").run(payload.meetingId);
      this.db.prepare("DELETE FROM attachment_content_fts WHERE meeting_id = ?").run(payload.meetingId);

      const upsertItem = this.db.prepare(`
        INSERT INTO agenda_items (
          item_id, meeting_id, parent_item_id, title, order_index, level, path_json, raw_html, plain_text, updated_at
        ) VALUES (
          @itemId, @meetingId, @parentItemId, @title, @orderIndex, @level, @pathJson, @rawHtml, @plainText, @updatedAt
        )
      `);

      const upsertFts = this.db.prepare(`
        INSERT INTO agenda_items_fts (item_id, meeting_id, title, plain_text)
        VALUES (@itemId, @meetingId, @title, @plainText)
      `);

      const upsertAttachment = this.db.prepare(`
        INSERT INTO attachments (
          attachment_key, attachment_id, item_id, meeting_id, file_name, source_url, local_path, mime_type, size_bytes, sha256, downloaded_at
        ) VALUES (
          @attachmentKey, @attachmentId, @itemId, @meetingId, @fileName, @sourceUrl, @localPath, @mimeType, @sizeBytes, @sha256, @downloadedAt
        )
      `);

      const upsertAttachmentContent = this.db.prepare(`
        INSERT INTO attachment_content (
          attachment_key, attachment_id, item_id, meeting_id, file_name, extracted_text, extraction_status, extracted_at
        ) VALUES (
          @attachmentKey, @attachmentId, @itemId, @meetingId, @fileName, @extractedText, @extractionStatus, @extractedAt
        )
      `);

      const upsertAttachmentFts = this.db.prepare(`
        INSERT INTO attachment_content_fts (
          attachment_key, attachment_id, item_id, meeting_id, file_name, extracted_text
        ) VALUES (
          @attachmentKey, @attachmentId, @itemId, @meetingId, @fileName, @extractedText
        )
      `);

      let attachmentCount = 0;

      for (const item of payload.items) {
        upsertItem.run({
          itemId: item.itemId,
          meetingId: payload.meetingId,
          parentItemId: item.parentItemId,
          title: item.title,
          orderIndex: item.orderIndex,
          level: item.level,
          pathJson: JSON.stringify(item.path),
          rawHtml: item.rawHtml,
          plainText: item.plainText,
          updatedAt: timestamp,
        });

        upsertFts.run({
          itemId: item.itemId,
          meetingId: payload.meetingId,
          title: item.title,
          plainText: item.plainText,
        });

        for (const attachment of attachmentArtifacts.filter((entry) => entry.itemId === item.itemId)) {
          upsertAttachment.run(attachment);
          upsertAttachmentContent.run(attachment);
          upsertAttachmentFts.run(attachment);
          attachmentCount += 1;
        }
      }

      this.db
        .prepare(
          `
          INSERT INTO imports (
            meeting_id, source_url, imported_at, item_count, attachment_count
          ) VALUES (?, ?, ?, ?, ?)
        `,
        )
        .run(
          payload.meetingId,
          payload.sourceUrl,
          payload.importedAt,
          payload.items.length,
          attachmentCount,
        );

      const snapshotPath = path.join(LOGS_DIR, `${safeSegment(payload.meetingId)}-${Date.now()}.json`);
      fs.writeFileSync(snapshotPath, JSON.stringify(payload, null, 2));

      return {
        meetingId: payload.meetingId,
        itemCount: payload.items.length,
        attachmentCount,
        snapshotPath,
      };
    });

    const result = transaction();
    return result;
  }
}
