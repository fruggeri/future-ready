import os from "node:os";
import path from "node:path";

const defaultDataDir = process.env.FUTUREREADY_DATA_DIR ?? path.join(os.homedir(), "FutureReadyData");

export const ARCHIVE_DATA_DIR = defaultDataDir;
export const ARCHIVE_DB_PATH =
  process.env.FUTUREREADY_DATA_DB ?? path.join(defaultDataDir, "futureready.sqlite");
