import fs from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";
import Database from "better-sqlite3";

import { ARCHIVE_DB_PATH } from "@/lib/archive-config";

type AttachmentRow = {
  local_path: string;
  file_name: string;
  mime_type: string;
};

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ attachmentKey: string }> },
) {
  const { attachmentKey } = await params;
  const db = new Database(ARCHIVE_DB_PATH, { readonly: true, fileMustExist: true });
  const row = db
    .prepare("SELECT local_path, file_name, mime_type FROM attachments WHERE attachment_key = ?")
    .get(decodeURIComponent(attachmentKey)) as AttachmentRow | undefined;
  db.close();

  if (!row || !fs.existsSync(row.local_path)) {
    return NextResponse.json({ error: "Attachment not found." }, { status: 404 });
  }

  const filePath = path.resolve(row.local_path);
  const file = await fs.promises.readFile(filePath);
  return new NextResponse(file, {
    headers: {
      "Content-Type": row.mime_type || "application/octet-stream",
      "Content-Length": String(file.byteLength),
      "Content-Disposition": `inline; filename="${row.file_name.replace(/["\\\r\n]/g, "_")}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
