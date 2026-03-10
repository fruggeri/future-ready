import os from "node:os";
import path from "node:path";

export const DEFAULT_PORT = 4318;
export const DATA_DIR =
  process.env.FUTUREREADY_DATA_DIR ??
  path.join(os.homedir(), "FutureReadyData");
export const ATTACHMENTS_DIR = path.join(DATA_DIR, "attachments");
export const LOGS_DIR = path.join(DATA_DIR, "logs");
export const DB_PATH = path.join(DATA_DIR, "futureready.sqlite");
