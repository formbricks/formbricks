import {
  AI_IMPORT_SOURCE_KINDS,
  IMPORT_ALLOWED_EXTENSIONS,
  IMPORT_LANE_BY_KIND,
  IMPORT_LEGACY_OFFICE_EXTENSIONS,
  type TImportAllowedExtension,
  type TImportLane,
  type TImportSourceKind,
} from "./types";

/**
 * File-name level helpers shared by the server detector and the browser drop zone. Deliberately free
 * of Node APIs (no `Buffer`) so the dialog can import them.
 */

export function getImportFileExtension(fileName: string | null | undefined): string | null {
  if (!fileName) return null;
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : null;
}

export function isImportAllowedExtension(extension: string): extension is TImportAllowedExtension {
  return Object.hasOwn(IMPORT_ALLOWED_EXTENSIONS, extension);
}

export function isLegacyOfficeExtension(extension: string | null): boolean {
  return extension !== null && (IMPORT_LEGACY_OFFICE_EXTENSIONS as readonly string[]).includes(extension);
}

export const IMPORT_KIND_BY_EXTENSION: Record<TImportAllowedExtension, TImportSourceKind> = {
  json: "v3-document",
  qsf: "qsf",
  docx: "docx",
  pdf: "pdf",
  md: "markdown",
  txt: "text",
  csv: "csv",
  xlsx: "xlsx",
};

/** The lane a file name points at, before its content is read. `null` for an unknown extension. */
export function getImportLaneForFileName(fileName: string): TImportLane | null {
  const extension = getImportFileExtension(fileName);
  if (!extension || !isImportAllowedExtension(extension)) return null;
  return IMPORT_LANE_BY_KIND[IMPORT_KIND_BY_EXTENSION[extension]];
}

export function isAiImportSourceKind(kind: TImportSourceKind): boolean {
  return AI_IMPORT_SOURCE_KINDS.includes(kind);
}

/** The `accept` attribute for the drop zone: extensions plus their MIME types. */
export function getImportAcceptList(): string[] {
  return Object.entries(IMPORT_ALLOWED_EXTENSIONS).flatMap(([extension, mimeTypes]) => [
    `.${extension}`,
    ...mimeTypes,
  ]);
}
