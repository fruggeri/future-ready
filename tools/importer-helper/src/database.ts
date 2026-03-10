import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import OpenAI from "openai";

import { extractAttachmentText } from "./attachment-text";
import { ATTACHMENTS_DIR, DB_PATH, LOGS_DIR } from "./config";
import type { MeetingPayload } from "./types";

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
  private openai: OpenAI | null;

  constructor() {
    ensureDirectories();
    this.db = new Database(DB_PATH);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.openai =
      process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "missing"
        ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
        : null;
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

      CREATE TABLE IF NOT EXISTS archive_settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS attachment_ai_index (
        attachment_key TEXT PRIMARY KEY,
        meeting_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        local_path TEXT NOT NULL,
        sha256 TEXT NOT NULL,
        vector_store_id TEXT,
        vector_store_file_id TEXT,
        status TEXT NOT NULL,
        last_error TEXT,
        indexed_at TEXT,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_attachment_ai_index_meeting_id ON attachment_ai_index(meeting_id);

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

  private getSetting(key: string) {
    const row = this.db
      .prepare("SELECT value FROM archive_settings WHERE key = ?")
      .get(key) as { value: string } | undefined;
    return row?.value ?? null;
  }

  private setSetting(key: string, value: string) {
    this.db
      .prepare(
        `
        INSERT INTO archive_settings (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
      `,
      )
      .run(key, value, new Date().toISOString());
  }

  private async ensureVectorStoreId() {
    if (!this.openai) {
      return null;
    }

    const existing = this.getSetting("openai_vector_store_id");
    if (existing) {
      return existing;
    }

    const vectorStore = await this.openai.vectorStores.create({
      name: "Miller Creek Board Archive",
      metadata: {
        app: "board-briefing-desk",
      },
    });

    this.setSetting("openai_vector_store_id", vectorStore.id);
    return vectorStore.id;
  }

  private async syncAttachmentToOpenAI(artifact: {
    attachmentKey: string;
    attachmentId: string;
    itemId: string;
    meetingId: string;
    fileName: string;
    localPath: string;
    sha256: string;
  }) {
    const updatedAt = new Date().toISOString();

    if (!this.openai) {
      this.db
        .prepare(
          `
          INSERT INTO attachment_ai_index (
            attachment_key, meeting_id, item_id, file_name, local_path, sha256, status, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(attachment_key) DO UPDATE SET
            meeting_id = excluded.meeting_id,
            item_id = excluded.item_id,
            file_name = excluded.file_name,
            local_path = excluded.local_path,
            sha256 = excluded.sha256,
            status = excluded.status,
            updated_at = excluded.updated_at
        `,
        )
        .run(
          artifact.attachmentKey,
          artifact.meetingId,
          artifact.itemId,
          artifact.fileName,
          artifact.localPath,
          artifact.sha256,
          "disabled",
          updatedAt,
        );
      return;
    }

    const existing = this.db
      .prepare(
        `
        SELECT sha256, status, vector_store_id, vector_store_file_id
        FROM attachment_ai_index
        WHERE attachment_key = ?
      `,
      )
      .get(artifact.attachmentKey) as
      | {
          sha256: string;
          status: string;
          vector_store_id: string | null;
          vector_store_file_id: string | null;
        }
      | undefined;

    if (existing && existing.sha256 === artifact.sha256 && existing.status === "completed") {
      return;
    }

    const vectorStoreId = await this.ensureVectorStoreId();
    if (!vectorStoreId) {
      return;
    }

    try {
      const uploaded = await this.openai.vectorStores.files.uploadAndPoll(
        vectorStoreId,
        fs.createReadStream(artifact.localPath),
      );

      await this.openai.vectorStores.files.update(uploaded.id, {
        vector_store_id: vectorStoreId,
        attributes: {
          attachment_key: artifact.attachmentKey,
          attachment_id: artifact.attachmentId,
          meeting_id: artifact.meetingId,
          item_id: artifact.itemId,
          file_name: artifact.fileName,
        },
      });

      this.db
        .prepare(
          `
          INSERT INTO attachment_ai_index (
            attachment_key, meeting_id, item_id, file_name, local_path, sha256, vector_store_id, vector_store_file_id, status, last_error, indexed_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(attachment_key) DO UPDATE SET
            meeting_id = excluded.meeting_id,
            item_id = excluded.item_id,
            file_name = excluded.file_name,
            local_path = excluded.local_path,
            sha256 = excluded.sha256,
            vector_store_id = excluded.vector_store_id,
            vector_store_file_id = excluded.vector_store_file_id,
            status = excluded.status,
            last_error = excluded.last_error,
            indexed_at = excluded.indexed_at,
            updated_at = excluded.updated_at
        `,
        )
        .run(
          artifact.attachmentKey,
          artifact.meetingId,
          artifact.itemId,
          artifact.fileName,
          artifact.localPath,
          artifact.sha256,
          vectorStoreId,
          uploaded.id,
          uploaded.status,
          uploaded.last_error?.message ?? null,
          updatedAt,
          updatedAt,
        );
    } catch (error) {
      this.db
        .prepare(
          `
          INSERT INTO attachment_ai_index (
            attachment_key, meeting_id, item_id, file_name, local_path, sha256, vector_store_id, status, last_error, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(attachment_key) DO UPDATE SET
            meeting_id = excluded.meeting_id,
            item_id = excluded.item_id,
            file_name = excluded.file_name,
            local_path = excluded.local_path,
            sha256 = excluded.sha256,
            vector_store_id = excluded.vector_store_id,
            status = excluded.status,
            last_error = excluded.last_error,
            updated_at = excluded.updated_at
        `,
        )
        .run(
          artifact.attachmentKey,
          artifact.meetingId,
          artifact.itemId,
          artifact.fileName,
          artifact.localPath,
          artifact.sha256,
          vectorStoreId,
          "failed",
          error instanceof Error ? error.message : "OpenAI indexing failed.",
          updatedAt,
        );
    }
  }

  async backfillOpenAIIndex() {
    const rows = this.db
      .prepare(
        `
        SELECT a.attachment_key, a.attachment_id, a.item_id, a.meeting_id, a.file_name, a.local_path, a.sha256
        FROM attachments a
        LEFT JOIN attachment_ai_index ai ON ai.attachment_key = a.attachment_key
        WHERE ai.attachment_key IS NULL OR ai.sha256 != a.sha256 OR ai.status != 'completed'
        ORDER BY a.meeting_id DESC
      `,
      )
      .all() as Array<{
      attachment_key: string;
      attachment_id: string;
      item_id: string;
      meeting_id: string;
      file_name: string;
      local_path: string;
      sha256: string;
    }>;

    for (const row of rows) {
      if (!fs.existsSync(row.local_path)) {
        continue;
      }

      await this.syncAttachmentToOpenAI({
        attachmentKey: row.attachment_key,
        attachmentId: row.attachment_id,
        itemId: row.item_id,
        meetingId: row.meeting_id,
        fileName: row.file_name,
        localPath: row.local_path,
        sha256: row.sha256,
      });
    }
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

    for (const artifact of attachmentArtifacts) {
      await this.syncAttachmentToOpenAI({
        attachmentKey: artifact.attachmentKey,
        attachmentId: artifact.attachmentId,
        itemId: artifact.itemId,
        meetingId: artifact.meetingId,
        fileName: artifact.fileName,
        localPath: artifact.localPath,
        sha256: artifact.sha256,
      });
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

    return transaction();
  }
}
