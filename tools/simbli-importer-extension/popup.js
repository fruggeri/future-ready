const statusEl = document.getElementById("status");
const buttonEl = document.getElementById("importButton");
const helperUrlEl = document.getElementById("helperUrl");

function setStatus(message) {
  statusEl.textContent = message;
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function loadHelperUrl() {
  const response = await chrome.runtime.sendMessage({ type: "GET_HELPER_URL" });
  helperUrlEl.value = response?.helperUrl ?? "http://127.0.0.1:4318";
}

helperUrlEl.addEventListener("change", async () => {
  await chrome.runtime.sendMessage({
    type: "SET_HELPER_URL",
    helperUrl: helperUrlEl.value.trim(),
  });
});

loadHelperUrl().catch(() => {
  helperUrlEl.value = "http://127.0.0.1:4318";
});

buttonEl.addEventListener("click", async () => {
  buttonEl.disabled = true;
  setStatus("Checking local helper...");

  try {
    const helperStatus = await chrome.runtime.sendMessage({ type: "IMPORT_ACTIVE_MEETING" });
    if (!helperStatus?.ok) {
      throw new Error(helperStatus?.error ?? "Import failed.");
    }

    const warningSummary =
      Array.isArray(helperStatus.warnings) && helperStatus.warnings.length > 0
        ? `\nWarnings (${helperStatus.warnings.length}):\n- ${helperStatus.warnings.slice(0, 3).join("\n- ")}${
            helperStatus.warnings.length > 3 ? "\n- ..." : ""
          }`
        : "";

    setStatus(
      `Imported ${helperStatus.itemCount} agenda items and ${helperStatus.attachmentCount} attachments.\nDatabase: ${helperStatus.dbPath ?? "local SQLite"}${warningSummary}`,
    );
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Import failed.");
  } finally {
    const activeTab = await getActiveTab();
    if (!activeTab?.url?.includes("simbli.eboardsolutions.com/SB_Meetings/ViewMeeting.aspx")) {
      setStatus("Open a Simbli meeting page, then try again.");
    }
    buttonEl.disabled = false;
  }
});
