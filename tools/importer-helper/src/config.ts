import os from "node:os";
import path from "node:path";

export const DEFAULT_PORT = 4318;
export const DEFAULT_HOST = "127.0.0.1";
export const DATA_DIR =
  process.env.FUTUREREADY_DATA_DIR ??
  path.join(os.homedir(), "FutureReadyData");
export const ATTACHMENTS_DIR = path.join(DATA_DIR, "attachments");
export const LOGS_DIR = path.join(DATA_DIR, "logs");
export const DB_PATH = path.join(DATA_DIR, "futureready.sqlite");

function normalizedUrl(value: string | undefined) {
  const normalized = value?.trim().replace(/\/+$/, "");
  return normalized || null;
}

export const SYNC_URL = normalizedUrl(process.env.FUTUREREADY_SYNC_URL);
export const SYNC_TOKEN =
  process.env.FUTUREREADY_SYNC_TOKEN?.trim() ||
  process.env.JWT_SECRET?.trim() ||
  "";
export const LIVE_APP_URL = normalizedUrl(process.env.FUTUREREADY_LIVE_APP_URL);
export const IMPORT_TOKEN = process.env.FUTUREREADY_IMPORT_TOKEN?.trim() || "";
