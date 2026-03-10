import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import xlsx from "xlsx";

type ExtractionResult = {
  extractedText: string;
  extractionStatus: "success" | "empty" | "unsupported" | "failed";
};

function normalizeText(value: string) {
  return value.replace(/\u0000/g, " ").replace(/\s+/g, " ").trim();
}

function extensionFromName(fileName: string) {
  const match = fileName.toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function textFromWorkbook(buffer: Buffer) {
  const workbook = xlsx.read(buffer, { type: "buffer" });
  const sheetTexts = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const rows = xlsx.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
    const body = rows.map((row) => row.map((cell) => `${cell ?? ""}`.trim()).filter(Boolean).join(" | ")).filter(Boolean).join("\n");
    return body ? `${sheetName}\n${body}` : "";
  }).filter(Boolean);

  return normalizeText(sheetTexts.join("\n\n"));
}

export async function extractAttachmentText(fileName: string, mimeType: string, buffer: Buffer): Promise<ExtractionResult> {
  const extension = extensionFromName(fileName);
  const lowerMimeType = mimeType.toLowerCase();

  try {
    if (extension === "pdf" || lowerMimeType.includes("pdf")) {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      await parser.destroy();
      const extractedText = normalizeText(result.text);
      return {
        extractedText,
        extractionStatus: extractedText ? "success" : "empty",
      };
    }

    if (extension === "docx" || lowerMimeType.includes("wordprocessingml")) {
      const result = await mammoth.extractRawText({ buffer });
      const extractedText = normalizeText(result.value);
      return {
        extractedText,
        extractionStatus: extractedText ? "success" : "empty",
      };
    }

    if (extension === "xlsx" || extension === "xls" || lowerMimeType.includes("spreadsheet")) {
      const extractedText = textFromWorkbook(buffer);
      return {
        extractedText,
        extractionStatus: extractedText ? "success" : "empty",
      };
    }

    if (["txt", "md", "csv", "json"].includes(extension) || lowerMimeType.startsWith("text/")) {
      const extractedText = normalizeText(buffer.toString("utf8"));
      return {
        extractedText,
        extractionStatus: extractedText ? "success" : "empty",
      };
    }

    return {
      extractedText: "",
      extractionStatus: "unsupported",
    };
  } catch {
    return {
      extractedText: "",
      extractionStatus: "failed",
    };
  }
}
