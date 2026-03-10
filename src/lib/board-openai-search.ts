import "server-only";

import Database from "better-sqlite3";

import { ARCHIVE_DB_PATH } from "@/lib/archive-config";
import { openai } from "@/lib/openai";

export type OpenAIAttachmentHit = {
  kind: "attachment";
  meetingId: string;
  itemId: string;
  title: string;
  itemTitle: string;
  snippet: string;
  fileName: string;
  sourceUrl?: string;
  localPath?: string;
  score: number;
};

function getDb() {
  return new Database(ARCHIVE_DB_PATH, {
    readonly: true,
    fileMustExist: true,
  });
}

function getVectorStoreId() {
  const db = getDb();
  const row = db
    .prepare("SELECT value FROM archive_settings WHERE key = 'openai_vector_store_id'")
    .get() as { value: string } | undefined;
  db.close();
  return row?.value ?? null;
}

function getAttachmentSource(attachmentKey: string) {
  const db = getDb();
  const row = db
    .prepare(
      `
      SELECT a.source_url, a.local_path, ai.title AS item_title
      FROM attachments a
      JOIN agenda_items ai ON ai.item_id = a.item_id
      WHERE a.attachment_key = ?
    `,
    )
    .get(attachmentKey) as
    | {
        source_url: string;
        local_path: string;
        item_title: string;
      }
    | undefined;
  db.close();
  return row;
}

export async function searchBoardAttachmentsOpenAI(query: string, meetingId?: string, maxResults = 8) {
  const vectorStoreId = getVectorStoreId();
  if (!vectorStoreId || !process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === "missing") {
    return [];
  }

  const response = await openai.vectorStores.search(vectorStoreId, {
    query,
    max_num_results: maxResults,
    rewrite_query: true,
    filters: meetingId
      ? {
          type: "eq",
          key: "meeting_id",
          value: meetingId,
        }
      : undefined,
  });

  return response.data.map((result) => {
    const attachmentKey = String(result.attributes?.attachment_key ?? "");
    const itemId = String(result.attributes?.item_id ?? "");
    const hitMeetingId = String(result.attributes?.meeting_id ?? "");
    const source = attachmentKey ? getAttachmentSource(attachmentKey) : undefined;
    return {
      kind: "attachment" as const,
      meetingId: hitMeetingId,
      itemId,
      title: result.filename,
      itemTitle: source?.item_title ?? String(result.attributes?.file_name ?? result.filename),
      fileName: result.filename,
      sourceUrl: source?.source_url,
      localPath: source?.local_path,
      snippet: result.content?.[0]?.text?.replace(/\s+/g, " ").trim() ?? "",
      score: result.score,
    };
  });
}
