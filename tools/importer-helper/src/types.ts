export type AttachmentPayload = {
  attachmentId: string;
  fileName: string;
  sourceUrl: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  base64Data: string;
};

export type AgendaItemPayload = {
  itemId: string;
  parentItemId: string | null;
  title: string;
  orderIndex: number;
  level: number;
  path: string[];
  rawHtml: string;
  plainText: string;
  supportingDocuments: AttachmentPayload[];
};

export type MeetingPayload = {
  importedAt: string;
  sourceUrl: string;
  districtId: string | null;
  meetingId: string;
  meetingTitle: string;
  meetingDateLabel: string | null;
  agendaTabLabel: string | null;
  items: AgendaItemPayload[];
};
