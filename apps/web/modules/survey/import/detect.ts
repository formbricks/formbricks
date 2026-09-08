import {
  IMPORT_ALLOWED_EXTENSIONS,
  IMPORT_LEGACY_OFFICE_EXTENSIONS,
  type TImportAllowedExtension,
  type TImportSourceKind,
} from "./types";

export type TImportDetectionFailureCode =
  | "empty_file"
  | "legacy_office_format"
  | "unsupported_source"
  | "invalid_json";

export type TImportDetection =
  | { ok: true; kind: TImportSourceKind }
  | { ok: false; code: TImportDetectionFailureCode; extension: string | null };

type TDetectInput = {
  fileName?: string | null;
  mimeType?: string | null;
  bytes?: Buffer | Uint8Array | null;
};

const ZIP_MAGIC = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const PDF_MAGIC = Buffer.from("%PDF");
/** How far into a zip we look for the entry names that tell DOCX from XLSX. */
const ZIP_SNIFF_BYTES = 64 * 1024;
const JSON_SNIFF_BYTES = 16 * 1024 * 1024;

export function getImportFileExtension(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : null;
}

function isAllowedExtension(extension: string): extension is TImportAllowedExtension {
  return Object.hasOwn(IMPORT_ALLOWED_EXTENSIONS, extension);
}

const MIME_TO_EXTENSION: Record<string, TImportAllowedExtension> = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/csv": "csv",
  "application/csv": "csv",
  "text/markdown": "md",
  "text/x-markdown": "md",
  "application/json": "json",
  "text/json": "json",
};

const EXTENSION_TO_KIND: Record<TImportAllowedExtension, TImportSourceKind> = {
  json: "v3-document",
  qsf: "qsf",
  docx: "docx",
  pdf: "pdf",
  md: "markdown",
  txt: "text",
  csv: "csv",
  xlsx: "xlsx",
};

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function looksLikeExportEnvelope(value: Record<string, unknown>): boolean {
  return isRecord(value.formbricks) && "exportFormat" in value.formbricks;
}

function looksLikeQsf(value: Record<string, unknown>): boolean {
  return "SurveyEntry" in value && "SurveyElements" in value;
}

function looksLikeV3Document(value: Record<string, unknown>): boolean {
  return typeof value.name === "string" && Array.isArray(value.blocks);
}

/** Classify parsed JSON: an export envelope, a QSF, a v3 document (optionally wrapped in `{ data }`), or none. */
export function detectJsonSourceKind(value: unknown): TImportSourceKind | null {
  if (!isRecord(value)) return null;
  if (looksLikeExportEnvelope(value)) return "formbricks-export";
  if (looksLikeQsf(value)) return "qsf";
  if (looksLikeV3Document(value)) return "v3-document";
  if (isRecord(value.data)) {
    if (looksLikeExportEnvelope(value.data)) return "formbricks-export";
    if (looksLikeV3Document(value.data)) return "v3-document";
  }
  return null;
}

function detectZipKind(bytes: Buffer): TImportSourceKind | null {
  const head = bytes.subarray(0, ZIP_SNIFF_BYTES).toString("latin1");
  if (head.includes("word/document.xml") || head.includes("word/_rels/")) return "docx";
  if (head.includes("xl/workbook.xml") || head.includes("xl/_rels/")) return "xlsx";
  return null;
}

type TTextDetection = { kind: TImportSourceKind } | { kind: null; invalidJson: boolean };

function detectTextKind(bytes: Buffer, extension: string | null): TTextDetection {
  const text = stripBom(bytes.subarray(0, JSON_SNIFF_BYTES).toString("utf8")).trimStart();
  const firstChar = text.charAt(0);
  if (firstChar !== "{" && firstChar !== "[") {
    return { kind: null, invalidJson: false };
  }

  if (bytes.byteLength > JSON_SNIFF_BYTES) {
    return { kind: null, invalidJson: false };
  }

  try {
    const parsed: unknown = JSON.parse(text);
    return { kind: detectJsonSourceKind(parsed), invalidJson: false };
  } catch {
    return { kind: null, invalidJson: extension === "json" || extension === "qsf" };
  }
}

/**
 * Decide which lane a source belongs to. Content wins over the extension, and the extension wins over
 * the MIME type (browsers send `application/octet-stream` for anything they do not know).
 */
export function detectImportSource(input: TDetectInput): TImportDetection {
  const extension = getImportFileExtension(input.fileName);
  const bytes = input.bytes ? Buffer.from(input.bytes) : null;

  if (extension && (IMPORT_LEGACY_OFFICE_EXTENSIONS as readonly string[]).includes(extension)) {
    return { ok: false, code: "legacy_office_format", extension };
  }

  if (bytes && bytes.byteLength === 0) {
    return { ok: false, code: "empty_file", extension };
  }

  if (bytes) {
    if (bytes.subarray(0, 4).equals(PDF_MAGIC)) {
      return { ok: true, kind: "pdf" };
    }

    if (bytes.subarray(0, 4).equals(ZIP_MAGIC)) {
      const zipKind = detectZipKind(bytes);
      return zipKind ? { ok: true, kind: zipKind } : { ok: false, code: "unsupported_source", extension };
    }

    const textDetection = detectTextKind(bytes, extension);
    if (textDetection.kind) {
      return { ok: true, kind: textDetection.kind };
    }
    if (textDetection.kind === null && textDetection.invalidJson) {
      return { ok: false, code: "invalid_json", extension };
    }
    if (extension === "json") {
      // Parsed fine but is none of the shapes we know.
      return { ok: false, code: "unsupported_source", extension };
    }
  }

  const resolvedExtension =
    extension && isAllowedExtension(extension)
      ? extension
      : input.mimeType
        ? MIME_TO_EXTENSION[input.mimeType.split(";")[0].trim().toLowerCase()]
        : undefined;

  if (!resolvedExtension) {
    return { ok: false, code: "unsupported_source", extension };
  }

  if (resolvedExtension === "json" && !bytes) {
    return { ok: true, kind: "v3-document" };
  }

  return { ok: true, kind: EXTENSION_TO_KIND[resolvedExtension] };
}

/** The `accept` attribute for the drop zone: extensions plus their MIME types. */
export function getImportAcceptList(): string[] {
  return Object.entries(IMPORT_ALLOWED_EXTENSIONS).flatMap(([extension, mimeTypes]) => [
    `.${extension}`,
    ...mimeTypes,
  ]);
}
