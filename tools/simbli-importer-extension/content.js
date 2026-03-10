function textContentOf(element) {
  return element?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function sleep(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function parseSourceUrl() {
  const url = new URL(window.location.href);
  return {
    sourceUrl: url.href,
    districtId: url.searchParams.get("S"),
    meetingId: url.searchParams.get("MID"),
  };
}

function getMeetingMetadata() {
  const title = textContentOf(document.querySelector("app-header .title-s span"));
  const agendaTabLabel = textContentOf(document.querySelector("app-vertical-tab .tab-highlighted"));
  return {
    meetingTitle: title,
    meetingDateLabel: title.includes("|") ? title.split("|")[1].trim() : null,
    agendaTabLabel,
  };
}

function buildItemUrl(itemId) {
  const url = new URL(window.location.href);
  url.searchParams.set("Tab", "Agenda");
  url.searchParams.set("enIID", itemId);
  return url.toString();
}

function buildPrintItemUrl(itemId) {
  const pageUrl = new URL(window.location.href);
  const url = new URL("/SB_Meetings/PrintAgendaItemNew.aspx", window.location.origin);
  const districtId = pageUrl.searchParams.get("S");
  const meetingId = pageUrl.searchParams.get("MID");

  if (districtId) {
    url.searchParams.set("S", districtId);
  }
  if (meetingId) {
    url.searchParams.set("MID", meetingId);
  }
  url.searchParams.set("enIID", itemId);
  return url.toString();
}

function buildPath(nodeItem) {
  const path = [];
  let current = nodeItem;

  while (current) {
    const title = textContentOf(current.querySelector(":scope > .node-title .level-strip span"));
    if (title) {
      path.unshift(title);
    }

    const parentChildren = current.parentElement?.closest(".node-children");
    if (!parentChildren) {
      break;
    }

    current = parentChildren.closest(".node-item");
  }

  return path;
}

function attachmentIdFromUrl(url) {
  try {
    const parsed = new URL(url, window.location.origin);
    return parsed.searchParams.get("AID") ?? url;
  } catch {
    return url;
  }
}

function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeTitle(value) {
  return normalizeText(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titlesMatch(left, right) {
  const normalizedLeft = normalizeTitle(left);
  const normalizedRight = normalizeTitle(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return (
    normalizedLeft === normalizedRight ||
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

function sanitizeContentClone(contentRoot) {
  const clone = contentRoot.cloneNode(true);
  clone.querySelectorAll("script, style, app-supporting-docs, .position-relative.supporting-dcmnt").forEach((node) => node.remove());
  clone.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...node.attributes]) {
      if (
        attribute.name.startsWith("_ngcontent") ||
        attribute.name.startsWith("_nghost") ||
        attribute.name === "tabindex" ||
        attribute.name === "style" ||
        attribute.name === "id" ||
        attribute.name === "class"
      ) {
        node.removeAttribute(attribute.name);
      }
    }
  });
  return clone;
}

function isVisibleElement(element) {
  if (!element) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
}

function findVisibleElement(selectors) {
  for (const selector of selectors) {
    const elements = Array.from(document.querySelectorAll(selector));
    const visible = elements.find((element) => isVisibleElement(element));
    if (visible) {
      return visible;
    }
  }

  return null;
}

function getLiveDetailRoot() {
  return findVisibleElement([
    ".item-details-wrap .data-scroll",
    ".item-details-wrap #itmContentTab",
    ".item-details-wrap app-itemcontent #itemComp_content",
    ".item-details-wrap app-itemdetails",
  ]);
}

function getLiveSupportingDocuments() {
  const detailRoot = findVisibleElement([
    ".item-details-wrap",
    "app-itemdetails",
  ]) || document;

  return Array.from(detailRoot.querySelectorAll("a.supportingDocText")).map((anchor) => ({
    attachmentId: attachmentIdFromUrl(anchor.href),
    fileName: anchor.getAttribute("title") || textContentOf(anchor) || "attachment",
    sourceUrl: anchor.href,
  }));
}

function getCurrentPrintItemUrl() {
  const link = findVisibleElement([
    'a[href*="PrintAgendaItemNew.aspx"]',
  ]);

  const href = link?.getAttribute("href") || "";
  if (!href) {
    return "";
  }

  try {
    return new URL(href, window.location.origin).toString();
  } catch {
    return "";
  }
}

function dedupeSupportingDocuments(documents) {
  const seen = new Set();
  return documents.filter((document) => {
    const key = `${document.attachmentId}|${document.fileName}|${document.sourceUrl}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function currentPaneContentSnapshot() {
  const contentRoot = getLiveDetailRoot();
  const text = normalizeText(contentRoot?.textContent ?? "");
  const attachmentKeys = getLiveSupportingDocuments()
    .map((attachment) => `${attachment.fileName}|${attachment.sourceUrl}`)
    .join("||");

  return `${text.slice(0, 1200)}::${attachmentKeys}`;
}

function hasUsefulLiveContent(item) {
  return normalizeText(item?.plainText ?? "").length >= 40 || (item?.supportingDocuments?.length ?? 0) > 0;
}

function extractStructuredText(contentRoot) {
  const sections = [];
  const blocks = Array.from(contentRoot.children);
  let currentHeading = "";

  for (const block of blocks) {
    const heading = block.querySelector(":scope > div > h3.h3-title, :scope > h3.h3-title");
    if (heading) {
      currentHeading = normalizeText(heading.textContent ?? "");
    }

    if (block.querySelector("app-supporting-docs")) {
      continue;
    }

    const text = normalizeText(block.textContent ?? "");
    if (!text) {
      continue;
    }

    const combined = currentHeading && !text.startsWith(currentHeading) ? `${currentHeading}\n${text}` : text;
    sections.push(combined);
  }

  return sections.join("\n\n");
}

function sanitizePrintClone(root) {
  const clone = root.cloneNode(true);
  clone.querySelectorAll("script, style, nav, header, footer, form, button, svg, img, iframe").forEach((node) => node.remove());
  clone.querySelectorAll("*").forEach((node) => {
    for (const attribute of [...node.attributes]) {
      if (
        attribute.name === "style" ||
        attribute.name === "class" ||
        attribute.name === "id" ||
        attribute.name.startsWith("on")
      ) {
        node.removeAttribute(attribute.name);
      }
    }
  });
  return clone;
}

function extractPrintItem(doc, nodeItem, orderIndex) {
  const fallbackTitle = textContentOf(nodeItem.querySelector(":scope > .node-title .level-strip span"));
  const titleCandidates = [
    doc.querySelector("h1"),
    doc.querySelector("h2"),
    doc.querySelector("h3"),
    doc.querySelector("title"),
  ];
  const docTitle = titleCandidates.map((node) => textContentOf(node)).find(Boolean) || fallbackTitle;

  const contentRoot =
    doc.querySelector(".removeFormat") ||
    doc.querySelector("#itemComp_content") ||
    doc.querySelector(".data-scroll") ||
    doc.querySelector("main") ||
    doc.body;

  const sanitizedClone = sanitizePrintClone(contentRoot);
  const rawHtml = sanitizedClone.innerHTML.trim();
  const plainText = normalizeText(sanitizedClone.textContent ?? "");

  const supportingDocuments = dedupeSupportingDocuments(
    Array.from(doc.querySelectorAll("a")).map((anchor) => ({
      attachmentId: attachmentIdFromUrl(anchor.href),
      fileName: anchor.getAttribute("title") || textContentOf(anchor) || "attachment",
      sourceUrl: anchor.href,
    })).filter((document) => /Attachment\.aspx|\.pdf\b|\.docx?\b|\.xlsx?\b/i.test(document.sourceUrl) || /supporting|document|attachment/i.test(document.fileName)),
  );

  return {
    itemId: nodeItem.dataset.id ?? "",
    parentItemId: nodeItem.parentElement?.closest(".node-children")?.id ?? null,
    title: docTitle || fallbackTitle,
    orderIndex,
    level: Number(nodeItem.getAttribute("level") ?? 0),
    path: buildPath(nodeItem),
    rawHtml,
    plainText,
    supportingDocuments,
  };
}

function extractItemFromDocument(doc, nodeItem, orderIndex) {
  const contentRoot = doc.querySelector("app-itemcontent #itemComp_content");
  const docTitle = textContentOf(doc.querySelector(".item-title-vm"));
  const fallbackTitle = textContentOf(nodeItem.querySelector(":scope > .node-title .level-strip span"));

  const supportingDocuments = dedupeSupportingDocuments(Array.from(doc.querySelectorAll("app-supporting-docs a.supportingDocText")).map((anchor) => ({
    attachmentId: attachmentIdFromUrl(anchor.href),
    fileName: anchor.getAttribute("title") || textContentOf(anchor) || "attachment",
    sourceUrl: anchor.href,
  })));

  let rawHtml = "";
  let plainText = "";

  if (contentRoot) {
    const sanitizedClone = sanitizeContentClone(contentRoot);
    rawHtml = sanitizedClone.innerHTML.trim();
    plainText = extractStructuredText(sanitizedClone) || normalizeText(sanitizedClone.textContent ?? "");
  } else {
    const fallbackContent =
      doc.querySelector(".data-scroll") ||
      doc.querySelector("#itmContentTab") ||
      doc.querySelector("app-itemdetails");
    if (fallbackContent) {
      const fallbackClone = sanitizeContentClone(fallbackContent);
      rawHtml = fallbackClone.innerHTML.trim();
      plainText = normalizeText(fallbackClone.textContent ?? "");
    }
  }

  return {
    itemId: nodeItem.dataset.id ?? "",
    parentItemId: nodeItem.parentElement?.closest(".node-children")?.id ?? null,
    title: docTitle || fallbackTitle,
    orderIndex,
    level: Number(nodeItem.getAttribute("level") ?? 0),
    path: buildPath(nodeItem),
    rawHtml,
    plainText,
    supportingDocuments,
  };
}

async function fetchItemDocument(itemId) {
  const response = await fetch(buildItemUrl(itemId), {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch item page for ${itemId}.`);
  }

  const html = await response.text();
  return new DOMParser().parseFromString(html, "text/html");
}

async function fetchPrintItemDocument(url) {
  if (!url) {
    throw new Error("Missing print item URL.");
  }

  const response = await fetch(url, {
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch print item page.`);
  }

  const html = await response.text();
  return new DOMParser().parseFromString(html, "text/html");
}

function extractCurrentLiveItem(nodeItem, orderIndex) {
  const contentRoot = getLiveDetailRoot();
  const docTitle = textContentOf(document.querySelector(".item-title-vm"));
  const fallbackTitle = textContentOf(nodeItem.querySelector(":scope > .node-title .level-strip span"));

  const supportingDocuments = dedupeSupportingDocuments(getLiveSupportingDocuments());

  let rawHtml = "";
  let plainText = "";

  if (contentRoot) {
    const sanitizedClone = sanitizeContentClone(contentRoot);
    rawHtml = sanitizedClone.innerHTML.trim();
    plainText = extractStructuredText(sanitizedClone) || normalizeText(sanitizedClone.textContent ?? "");
  }

  return {
    itemId: nodeItem.dataset.id ?? "",
    parentItemId: nodeItem.parentElement?.closest(".node-children")?.id ?? null,
    title: docTitle || fallbackTitle,
    orderIndex,
    level: Number(nodeItem.getAttribute("level") ?? 0),
    path: buildPath(nodeItem),
    rawHtml,
    plainText,
    supportingDocuments,
  };
}

async function clickAndWaitForLiveContent(nodeItem) {
  const button = nodeItem.querySelector(":scope > .node-title .level-strip");
  if (!button) {
    throw new Error("Agenda item button not found.");
  }

  const nodeId = nodeItem.dataset.id ?? "";
  const expectedTitle = textContentOf(button.querySelector("span"));
  const beforeContent = currentPaneContentSnapshot();
  const beforePrintItemUrl = getCurrentPrintItemUrl();
  button.click();

  for (let attempt = 0; attempt < 40; attempt += 1) {
    await sleep(200);
    const currentTitle = textContentOf(document.querySelector(".item-title-vm"));
    const currentContent = currentPaneContentSnapshot();
    const printItemUrl = getCurrentPrintItemUrl();
    const titleMatches = titlesMatch(currentTitle, expectedTitle);
    const contentChanged = currentContent !== beforeContent;
    const hasUsefulText = normalizeText(getLiveDetailRoot()?.textContent ?? "").length > 0;
    const printUrlChanged = Boolean(printItemUrl) && printItemUrl !== beforePrintItemUrl;
    const printUrlMatches = !nodeId || !printItemUrl || decodeURIComponent(printItemUrl).includes(nodeId);

    if (titleMatches && printUrlMatches && (contentChanged || printUrlChanged || !hasUsefulText)) {
      await sleep(250);

      const settledContent = currentPaneContentSnapshot();
      const settledTitle = textContentOf(document.querySelector(".item-title-vm"));
      const settledPrintItemUrl = getCurrentPrintItemUrl();
      const settledTitleMatches = titlesMatch(settledTitle, expectedTitle);
      const settledContentChanged = settledContent !== beforeContent;
      const settledPrintUrlMatches =
        !nodeId || !settledPrintItemUrl || decodeURIComponent(settledPrintItemUrl).includes(nodeId);

      if (!settledTitleMatches || !settledPrintUrlMatches || (!settledContentChanged && !printUrlChanged && hasUsefulText)) {
        continue;
      }

      return {
        printItemUrl: settledPrintItemUrl,
      };
    }
  }

  return {
    printItemUrl: getCurrentPrintItemUrl(),
  };
}

async function settleLiveItem(nodeItem, orderIndex) {
  const expectedTitle = textContentOf(nodeItem.querySelector(":scope > .node-title .level-strip span"));
  let bestItem = extractCurrentLiveItem(nodeItem, orderIndex);

  if (titlesMatch(bestItem.title, expectedTitle) && hasUsefulLiveContent(bestItem)) {
    return bestItem;
  }

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await sleep(250);
    const candidate = extractCurrentLiveItem(nodeItem, orderIndex);
    const candidateTitle = candidate.title || expectedTitle;

    if (titlesMatch(candidateTitle, expectedTitle)) {
      bestItem = candidate;
      if (hasUsefulLiveContent(candidate)) {
        return candidate;
      }
    }
  }

  return bestItem;
}

async function scrapeMeeting() {
  const source = parseSourceUrl();
  if (!source.meetingId) {
    throw new Error("Could not determine the meeting ID from the page URL.");
  }

  const nodes = Array.from(document.querySelectorAll("app-itemtree .node-item[data-id]"));
  const items = [];
  const warnings = [];
  let orderIndex = 0;

  for (const node of nodes) {
    const itemId = node.dataset.id;
    if (!itemId) {
      continue;
    }
    const expectedTitle = textContentOf(node.querySelector(":scope > .node-title .level-strip span"));
    let item = null;
    try {
      const liveState = await clickAndWaitForLiveContent(node);
      item = await settleLiveItem(node, orderIndex);
      const printDocument = await fetchPrintItemDocument(liveState.printItemUrl || buildPrintItemUrl(itemId));
      const printItem = extractPrintItem(printDocument, node, orderIndex);
      item = {
        ...item,
        rawHtml: titlesMatch(printItem.title, expectedTitle) && printItem.plainText ? printItem.rawHtml : item.rawHtml,
        plainText:
          titlesMatch(printItem.title, expectedTitle) && printItem.plainText ? printItem.plainText : item.plainText,
        supportingDocuments: dedupeSupportingDocuments([
          ...item.supportingDocuments,
          ...(titlesMatch(printItem.title, expectedTitle) ? printItem.supportingDocuments : []),
        ]),
      };
    } catch {
      try {
        const printDocument = await fetchPrintItemDocument(getCurrentPrintItemUrl() || buildPrintItemUrl(itemId));
        const printItem = extractPrintItem(printDocument, node, orderIndex);
        item = titlesMatch(printItem.title, expectedTitle)
          ? printItem
          : await settleLiveItem(node, orderIndex);
      } catch (printError) {
        try {
          const itemDocument = await fetchItemDocument(itemId);
          const documentItem = extractItemFromDocument(itemDocument, node, orderIndex);
          item = titlesMatch(documentItem.title, expectedTitle)
            ? documentItem
            : await settleLiveItem(node, orderIndex);
        } catch (itemError) {
          item = await settleLiveItem(node, orderIndex);
          warnings.push(
            `Item fallback warning for "${expectedTitle}": ${
              itemError instanceof Error
                ? itemError.message
                : printError instanceof Error
                  ? printError.message
                  : "fetch failed"
            }`,
          );
        }
      }
    }

    items.push(item);
    orderIndex += 1;
  }

  return {
    importedAt: new Date().toISOString(),
    sourceUrl: source.sourceUrl,
    districtId: source.districtId,
    meetingId: source.meetingId,
    ...getMeetingMetadata(),
    items,
    warnings,
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "SCRAPE_MEETING") {
    return false;
  }

  scrapeMeeting()
    .then((payload) => sendResponse({ ok: true, payload }))
    .catch((error) =>
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Meeting scrape failed.",
      }),
    );

  return true;
});
