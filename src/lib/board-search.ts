import "server-only";

import Database from "better-sqlite3";

import { ARCHIVE_DB_PATH } from "@/lib/archive-config";

export type BoardSearchHit = {
  kind: "agenda" | "attachment";
  meetingId: string;
  itemId: string;
  title: string;
  itemTitle: string;
  snippet: string;
  fileName?: string;
  localPath?: string;
  sourceUrl?: string;
  score: number;
};

function getDb() {
  return new Database(ARCHIVE_DB_PATH, {
    readonly: true,
    fileMustExist: true,
  });
}

function tableExists(db: Database.Database, tableName: string) {
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'view') AND name = ?")
    .get(tableName) as { name: string } | undefined;
  return Boolean(row);
}

function normalizeSnippet(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function buildFtsQuery(query: string) {
  const normalized = query
    .trim()
    .replace(/"/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "";
  }

  return `"${normalized}"`;
}

function buildKeywordTokens(query: string) {
  const stopWords = new Set([
    "the",
    "a",
    "an",
    "what",
    "does",
    "do",
    "show",
    "about",
    "tell",
    "me",
    "is",
    "are",
    "for",
    "of",
    "to",
    "in",
    "on",
    "and",
    "or",
    "with",
    "this",
    "that",
    "meeting",
    "archive",
    "contract",
  ]);

  return query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function searchBoardArchiveByKeywords(tokens: string[], meetingId?: string, limit = 8): BoardSearchHit[] {
  const usableTokens = tokens
    .map((token) => token.replace(/[^a-z0-9]/gi, ""))
    .filter(Boolean);

  if (usableTokens.length === 0) {
    return [];
  }

  const ftsQuery = usableTokens.map((token) => `${token}*`).join(" OR ");
  if (!ftsQuery) {
    return [];
  }

  return searchBoardArchiveInternal(ftsQuery, meetingId, limit);
}

function searchBoardArchiveInternal(ftsQuery: string, meetingId?: string, limit = 6): BoardSearchHit[] {
  if (!ftsQuery) {
    return [];
  }

  const db = getDb();
  const hasAgendaFts = tableExists(db, "agenda_items_fts");
  const hasAttachmentTables =
    tableExists(db, "attachment_content") &&
    tableExists(db, "attachment_content_fts") &&
    tableExists(db, "attachments");

  if (!hasAgendaFts) {
    db.close();
    return [];
  }

  const agendaRows = db
    .prepare(
      `
      SELECT
        ai.meeting_id,
        ai.item_id,
        ai.title,
        ai.plain_text,
        bm25(agenda_items_fts) AS score
      FROM agenda_items_fts
      JOIN agenda_items ai ON ai.item_id = agenda_items_fts.item_id
      WHERE agenda_items_fts MATCH ?
        AND (? IS NULL OR ai.meeting_id = ?)
      ORDER BY score
      LIMIT ?
    `,
    )
    .all(ftsQuery, meetingId ?? null, meetingId ?? null, limit) as Array<{
    meeting_id: string;
    item_id: string;
    title: string;
    plain_text: string;
    score: number;
  }>;

  const attachmentRows = hasAttachmentTables
    ? (db
        .prepare(
          `
          SELECT
            ac.meeting_id,
            ac.item_id,
            ai.title AS item_title,
            ac.file_name,
            ac.extracted_text,
            at.local_path,
            at.source_url,
            bm25(attachment_content_fts) AS score
          FROM attachment_content_fts
          JOIN attachment_content ac ON ac.attachment_key = attachment_content_fts.attachment_key
          JOIN agenda_items ai ON ai.item_id = ac.item_id
          JOIN attachments at ON at.attachment_key = ac.attachment_key
          WHERE attachment_content_fts MATCH ?
            AND (? IS NULL OR ac.meeting_id = ?)
          ORDER BY score
          LIMIT ?
        `,
        )
        .all(ftsQuery, meetingId ?? null, meetingId ?? null, limit) as Array<{
        meeting_id: string;
        item_id: string;
        item_title: string;
        file_name: string;
        extracted_text: string;
        local_path: string;
        source_url: string;
        score: number;
      }>)
    : [];

  db.close();

  const hits: BoardSearchHit[] = [
    ...agendaRows.map((row) => ({
      kind: "agenda" as const,
      meetingId: row.meeting_id,
      itemId: row.item_id,
      title: row.title,
      itemTitle: row.title,
      snippet: normalizeSnippet(row.plain_text).slice(0, 240),
      score: row.score,
    })),
    ...attachmentRows.map((row) => ({
      kind: "attachment" as const,
      meetingId: row.meeting_id,
      itemId: row.item_id,
      title: row.file_name,
      itemTitle: row.item_title,
      fileName: row.file_name,
      localPath: row.local_path,
      sourceUrl: row.source_url,
      snippet: normalizeSnippet(row.extracted_text).slice(0, 240),
      score: row.score,
    })),
  ];

  return hits.sort((left, right) => left.score - right.score).slice(0, limit * 2);
}

function createSnippet(text: string, query: string, maxLength = 240) {
  const normalizedText = normalizeSnippet(text);
  if (!normalizedText) {
    return "";
  }

  const lowerText = normalizedText.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const index = lowerText.indexOf(lowerQuery);

  if (index === -1 || normalizedText.length <= maxLength) {
    return normalizedText.slice(0, maxLength);
  }

  const start = Math.max(0, index - 80);
  const end = Math.min(normalizedText.length, start + maxLength);
  const prefix = start > 0 ? "..." : "";
  const suffix = end < normalizedText.length ? "..." : "";

  return `${prefix}${normalizedText.slice(start, end)}${suffix}`;
}

export function searchBoardArchive(query: string, meetingId?: string, limit = 6): BoardSearchHit[] {
  const ftsQuery = buildFtsQuery(query);
  const hits = searchBoardArchiveInternal(ftsQuery, meetingId, limit);
  return hits.map((hit) => ({
    ...hit,
    snippet: createSnippet(hit.snippet, query),
  }));
}

export function buildBoardChatContext(query: string, meetingId?: string) {
  let hits = searchBoardArchive(query, meetingId, 5);

  if (hits.length === 0) {
    const keywordTokens = buildKeywordTokens(query);
    if (keywordTokens.length > 0) {
      hits = searchBoardArchiveByKeywords(keywordTokens, meetingId, 8);
    }
  }

  const countPrefix =
    /\bhow many\b/i.test(query) && hits.length > 0
      ? `Matching records found: ${hits.length}.\n\n`
      : "";

  const context = hits
    .map((hit, index) => {
      if (hit.kind === "attachment") {
        return `[${index + 1}] Attachment: ${hit.fileName}\nAgenda Item: ${hit.itemTitle}\nExcerpt: ${hit.snippet}`;
      }

      return `[${index + 1}] Agenda Item: ${hit.title}\nExcerpt: ${hit.snippet}`;
    })
    .join("\n\n");

  return { hits, context: `${countPrefix}${context}` };
}
