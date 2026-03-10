import "dotenv/config";
import http from "node:http";

import { DEFAULT_PORT, DB_PATH, DATA_DIR } from "./config";
import { ImporterDatabase } from "./database";
import type { MeetingPayload } from "./types";

const db = new ImporterDatabase();
const port = Number(process.env.FUTUREREADY_HELPER_PORT ?? DEFAULT_PORT);

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
    });
    return;
  }

  if (request.method === "POST" && request.url === "/imports/meeting") {
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

  sendJson(response, 404, { error: "Not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`FutureReady importer helper listening on http://127.0.0.1:${port}`);
  console.log(`Writing data to ${DATA_DIR}`);
  db.backfillOpenAIIndex().catch((error) => {
    console.error("OpenAI backfill failed:", error);
  });
});
