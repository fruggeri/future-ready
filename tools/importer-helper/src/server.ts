import "dotenv/config";
import http from "node:http";
import crypto from "node:crypto";

import { DEFAULT_HOST, DEFAULT_PORT, DB_PATH, DATA_DIR, IMPORT_TOKEN, IOS_ARCHIVE_PATH, SYNC_URL } from "./config";
import { ImporterDatabase } from "./database";
import { publishIOSArchive } from "./ios-archive";
import { syncMeetingToRemote } from "./sync";
import type { FinishMeetingPayload, MeetingHeaderPayload, MeetingItemPayload, MeetingPayload } from "./types";

const db = new ImporterDatabase();
const port = Number(process.env.FUTUREREADY_HELPER_PORT ?? DEFAULT_PORT);
const host = process.env.FUTUREREADY_HELPER_HOST ?? DEFAULT_HOST;
let syncInProgress = false;

function sendJson(response: http.ServerResponse, status: number, body: unknown) {
  response.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

async function readJson<T>(request: http.IncomingMessage): Promise<T> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8")) as T;
}

function isAuthorized(request: http.IncomingMessage) {
  if (!IMPORT_TOKEN) {
    return true;
  }

  const authorization = request.headers.authorization ?? "";
  const supplied = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  const expectedBuffer = Buffer.from(IMPORT_TOKEN);
  const suppliedBuffer = Buffer.from(supplied);
  return suppliedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(suppliedBuffer, expectedBuffer);
}

async function syncQueuedMeetings(targetMeetingId?: string) {
  if (!SYNC_URL || syncInProgress) {
    return null;
  }

  syncInProgress = true;
  let targetResult: Awaited<ReturnType<typeof syncMeetingToRemote>> | null = null;
  try {
    const meetingIds = targetMeetingId ? [targetMeetingId] : db.getPendingMeetingIds();
    for (const meetingId of meetingIds) {
      try {
        const result = await syncMeetingToRemote(db, meetingId);
        db.markMeetingSyncSucceeded(meetingId);
        if (meetingId === targetMeetingId) targetResult = result;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Live meeting sync failed.";
        db.markMeetingSyncFailed(meetingId, message);
        if (meetingId === targetMeetingId) throw error;
      }
    }
    return targetResult;
  } finally {
    syncInProgress = false;
  }
}

const server = http.createServer(async (request, response) => {
  if (!request.url || !request.method) {
    sendJson(response, 400, { error: "Invalid request" });
    return;
  }

  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return;
  }

  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, 200, {
      ok: true,
      port,
      dataDir: DATA_DIR,
      dbPath: DB_PATH,
      liveSyncConfigured: Boolean(SYNC_URL),
      pendingSyncCount: db.getPendingMeetingIds().length,
      iosArchiveConfigured: Boolean(IOS_ARCHIVE_PATH),
    });
    return;
  }

  if (request.method === "POST" && request.url === "/imports/meeting") {
    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }
    try {
      const payload = await readJson<MeetingPayload>(request);
      if (!payload.meetingId || !payload.sourceUrl || !Array.isArray(payload.items)) {
        sendJson(response, 400, { error: "Invalid meeting payload" });
        return;
      }

      const result = await db.saveMeeting(payload);
      sendJson(response, 200, { ok: true, ...result });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(response, 500, { error: message });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/imports/start") {
    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }
    try {
      const payload = await readJson<MeetingHeaderPayload>(request);
      if (!payload.meetingId || !payload.sourceUrl) {
        sendJson(response, 400, { error: "Invalid meeting start payload" });
        return;
      }

      db.prepareMeeting(payload);
      sendJson(response, 200, { ok: true, meetingId: payload.meetingId });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(response, 500, { error: message });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/imports/item") {
    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }
    try {
      const payload = await readJson<MeetingItemPayload>(request);
      if (!payload.meetingId || !payload.sourceUrl || !payload.item?.itemId) {
        sendJson(response, 400, { error: "Invalid meeting item payload" });
        return;
      }

      const result = await db.saveMeetingItem(payload);
      sendJson(response, 200, { ok: true, ...result });
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(response, 500, { error: message });
      return;
    }
  }

  if (request.method === "POST" && request.url === "/imports/finish") {
    if (!isAuthorized(request)) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }
    try {
      const payload = await readJson<FinishMeetingPayload>(request);
      if (!payload.meetingId || !payload.sourceUrl) {
        sendJson(response, 400, { error: "Invalid meeting finish payload" });
        return;
      }

      const result = db.finishMeeting(payload);
      const iosArchive = publishIOSArchive(db, [payload.meetingId]);
      if (!SYNC_URL) {
        sendJson(response, 200, { ok: true, ...result, iosArchive, liveSyncConfigured: false, synced: false });
        return;
      }

      db.queueMeetingSync(payload.meetingId);
      try {
        const syncResult = await syncQueuedMeetings(payload.meetingId);
        sendJson(response, 200, { ok: true, ...result, iosArchive, ...syncResult });
      } catch (syncError) {
        sendJson(response, 200, {
          ok: true,
          ...result,
          liveSyncConfigured: true,
          synced: false,
          syncError: syncError instanceof Error ? syncError.message : "Live meeting sync failed.",
        });
      }
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      sendJson(response, 500, { error: message });
      return;
    }
  }

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, host, () => {
  console.log(`FutureReady importer helper listening on http://${host}:${port}`);
  console.log(`Writing data to ${DATA_DIR}`);
  if (IOS_ARCHIVE_PATH) {
    try {
      const result = publishIOSArchive(db);
      console.log(`Published ${result?.meetingCount ?? 0} meetings to the iOS archive.`);
    } catch (error) {
      console.error("Initial iOS archive publish failed:", error);
    }
  }
  db.backfillOpenAIIndex().catch((error) => {
    console.error("OpenAI backfill failed:", error);
  });
  syncQueuedMeetings().catch((error) => {
    console.error("Pending live meeting sync failed:", error);
  });
});

setInterval(() => {
  syncQueuedMeetings().catch((error) => {
    console.error("Scheduled live meeting sync failed:", error);
  });
}, 60_000).unref();
