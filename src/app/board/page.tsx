import { BoardDashboard } from "./BoardDashboard";
import { getImportedMeetingDetail, getImportedMeetings } from "@/lib/importer-data";

type BoardPageProps = {
  searchParams: Promise<{
    meetingId?: string;
    itemId?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function BoardPage({ searchParams }: BoardPageProps) {
  const params = await searchParams;
  const meetings = getImportedMeetings();
  const selectedMeetingId = params.meetingId ?? meetings[0]?.meetingId ?? "";
  const initialMeeting = selectedMeetingId ? getImportedMeetingDetail(selectedMeetingId) : null;

  return <BoardDashboard meetings={meetings} initialMeeting={initialMeeting} initialItemId={params.itemId ?? null} />;
}
