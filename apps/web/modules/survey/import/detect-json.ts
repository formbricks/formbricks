import type { TImportSourceKind } from "./types";

/** Shape sniffing on already-parsed JSON. Browser-safe: the dialog uses it to route `.json` files. */

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
