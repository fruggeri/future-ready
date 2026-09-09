import { NextResponse } from "next/server";

/** Chat was retired from the board briefing desk. */
export async function POST() {
  return NextResponse.json({ error: "Archive chat is no longer available." }, { status: 404 });
}
