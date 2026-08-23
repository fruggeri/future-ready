import { LIVE_APP_URL, SYNC_TOKEN, SYNC_URL } from "./config";
import type { ImporterDatabase } from "./database";
import type { FinishMeetingPayload } from "./types";

type RemoteJson = Record<string, unknown>;

async function postJson(path: string, body: unknown) {
  if (!SYNC_URL) {
    throw new Error("Live sync is not configured.");
  }

  const response = await fetch(`${SYNC_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(SYNC_TOKEN ? { Authorization: `Bearer ${SYNC_TOKEN}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(180_000),
  });

  const raw = await response.text();
  const data = raw ? (JSON.parse(raw) as RemoteJson) : {};
  if (!response.ok) {
    throw new Error(typeof data.error === "string" ? data.error : `Live helper returned HTTP ${response.status}.`);
  }
  return data;
}

export function liveMeetingUrl(meetingId: string) {
  return LIVE_APP_URL
    ? `${LIVE_APP_URL}/board?meetingId=${encodeURIComponent(meetingId)}`
    : null;
}

export async function syncMeetingToRemote(db: ImporterDatabase, meetingId: string) {
  if (!SYNC_URL) {
    return { configured: false, synced: false, liveMeetingUrl: null };
  }

  const meeting = db.getMeetingPayload(meetingId);
  await postJson("/imports/start", {
    importedAt: meeting.importedAt,
    sourceUrl: meeting.sourceUrl,
    districtId: meeting.districtId,
    meetingId: meeting.meetingId,
    meetingTitle: meeting.meetingTitle,
    meetingDateLabel: meeting.meetingDateLabel,
    agendaTabLabel: meeting.agendaTabLabel,
  });

  let attachmentCount = 0;
  for (const item of meeting.items) {
    attachmentCount += item.supportingDocuments.length;
    await postJson("/imports/item", {
      meetingId: meeting.meetingId,
      importedAt: meeting.importedAt,
      sourceUrl: meeting.sourceUrl,
      item,
    });
  }

  const finishPayload: FinishMeetingPayload = {
    meetingId: meeting.meetingId,
    importedAt: meeting.importedAt,
    sourceUrl: meeting.sourceUrl,
    itemCount: meeting.items.length,
    attachmentCount,
  };
  await postJson("/imports/finish", finishPayload);

  return {
    configured: true,
    synced: true,
    itemCount: meeting.items.length,
    attachmentCount,
    liveMeetingUrl: liveMeetingUrl(meeting.meetingId),
  };
}
