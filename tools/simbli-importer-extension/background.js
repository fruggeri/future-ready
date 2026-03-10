const DEFAULT_HELPER_URL = "http://127.0.0.1:4318";

async function getHelperUrl() {
  const stored = await chrome.storage.sync.get("helperUrl");
  return stored.helperUrl || DEFAULT_HELPER_URL;
}

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");
}

function toBase64(buffer) {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

async function fetchAttachmentBinary(attachment) {
  const response = await fetch(attachment.sourceUrl, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Attachment download failed: ${attachment.fileName}`);
  }

  const buffer = await response.arrayBuffer();

  return {
    ...attachment,
    mimeType: response.headers.get("content-type") ?? "application/octet-stream",
    sizeBytes: buffer.byteLength,
    sha256: await sha256Hex(buffer),
    base64Data: toBase64(buffer),
  };
}

async function importMeeting(tabId) {
  const helperUrl = await getHelperUrl();
  const healthResponse = await fetch(`${helperUrl}/health`);
  if (!healthResponse.ok) {
    throw new Error(`Importer helper is not reachable at ${helperUrl}.`);
  }
  const health = await healthResponse.json();

  const meeting = await chrome.tabs.sendMessage(tabId, { type: "SCRAPE_MEETING" });
  if (!meeting?.ok) {
    throw new Error(meeting?.error ?? "Could not scrape the current meeting page.");
  }

  const items = [];
  for (const item of meeting.payload.items) {
    const supportingDocuments = [];
    for (const attachment of item.supportingDocuments) {
      supportingDocuments.push(await fetchAttachmentBinary(attachment));
    }

    items.push({
      ...item,
      supportingDocuments,
    });
  }

  const saveResponse = await fetch(`${helperUrl}/imports/meeting`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      ...meeting.payload,
      items,
    }),
  });

  if (!saveResponse.ok) {
    const details = await saveResponse.json().catch(() => null);
    throw new Error(details?.error ?? "Failed to save the meeting locally.");
  }

  const result = await saveResponse.json();
  return {
    ok: true,
    ...result,
    dbPath: health.dbPath,
  };
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "SET_HELPER_URL") {
    chrome.storage.sync.set({ helperUrl: message.helperUrl }).then(() => {
      sendResponse({ ok: true });
    });
    return true;
  }

  if (message.type === "GET_HELPER_URL") {
    getHelperUrl().then((helperUrl) => sendResponse({ ok: true, helperUrl }));
    return true;
  }

  if (message.type === "IMPORT_ACTIVE_MEETING") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      try {
        const tab = tabs[0];
        if (!tab?.id || !tab.url?.includes("simbli.eboardsolutions.com/SB_Meetings/ViewMeeting.aspx")) {
          throw new Error("Open a Simbli meeting page before importing.");
        }

        const result = await importMeeting(tab.id);
        sendResponse(result);
      } catch (error) {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : "Import failed.",
        });
      }
    });

    return true;
  }

  return false;
});
