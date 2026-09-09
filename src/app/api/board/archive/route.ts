import { NextResponse } from "next/server";

import { getImportedMeetingDetail, getImportedMeetings } from "@/lib/importer-data";

export const dynamic = "force-dynamic";

export async function GET() {
  const meetings = getImportedMeetings();
  const details = meetings.reduce<Record<string, NonNullable<ReturnType<typeof getImportedMeetingDetail>>>>((archive, meeting) => {
    const detail = getImportedMeetingDetail(meeting.meetingId);
    if (detail) archive[meeting.meetingId] = detail;
    return archive;
  }, {});

  return NextResponse.json({ meetings, details });
}
