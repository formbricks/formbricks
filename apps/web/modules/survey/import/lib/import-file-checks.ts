import { getImportFileExtension, getImportLaneForFileName, isLegacyOfficeExtension } from "../file-types";
import { IMPORT_MAX_FILE_BYTES } from "../types";

export type TImportFileCheckCode =
  | "payload_too_large"
  | "legacy_office_format"
  | "unsupported_source"
  | "ai_unavailable_for_file"
  | "empty_file";

/**
 * What the drop zone can refuse before a byte leaves the browser: size, legacy Office formats, an
 * unknown extension, and an AI-lane file when AI is unavailable in this organization.
 */
export function checkImportFile(
  file: { name: string; size: number },
  isAIAvailable: boolean
): TImportFileCheckCode | null {
  if (file.size === 0) return "empty_file";
  if (file.size > IMPORT_MAX_FILE_BYTES) return "payload_too_large";

  const extension = getImportFileExtension(file.name);
  if (isLegacyOfficeExtension(extension)) return "legacy_office_format";

  const lane = getImportLaneForFileName(file.name);
  if (lane === null) return "unsupported_source";
  if (lane === "ai" && !isAIAvailable) return "ai_unavailable_for_file";

  return null;
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
