import { NextResponse } from "next/server";

import { searchBoardArchive } from "@/lib/board-search";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q")?.trim() ?? "";
    const meetingId = searchParams.get("meetingId")?.trim() || undefined;

    if (!query) {
      return NextResponse.json({ results: [] });
    }

    return NextResponse.json({ results: searchBoardArchive(query, meetingId).slice(0, 16) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Search failed.";
    return NextResponse.json({ error: message, results: [] }, { status: 500 });
  }
}
