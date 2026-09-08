import type { TSurveyExportReferences } from "@/app/api/v3/surveys/export/schemas";
import { type TV3InvalidParam, parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TImportReport, TImportReportSource } from "@/modules/survey/import/types";

export type TImportValidation = { valid: boolean; invalid_params: TV3InvalidParam[] };

/** What both the dry run and the convert endpoint answer: a resolved draft plus its report. */
export type TImportConvertResult = {
  document: Record<string, unknown> | null;
  references: TSurveyExportReferences | null;
  report: TImportReport;
  validation: TImportValidation;
  source?: TImportReportSource;
};

const IMPORT_ENDPOINT = "/api/v3/surveys/import";
const CONVERT_ENDPOINT = "/api/v3/surveys/import/convert";

async function readData<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  return ((await response.json()) as { data: T }).data;
}

/** Resolve a JSON source (export envelope or raw document) for the workspace without creating anything. */
export async function importSurveyDryRun(params: {
  workspaceId: string;
  source: { export: Record<string, unknown> } | { document: Record<string, unknown> };
  references?: TSurveyExportReferences | null;
  signal?: AbortSignal;
}): Promise<TImportConvertResult> {
  const response = await fetch(IMPORT_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: params.workspaceId,
      ...params.source,
      ...(params.references ? { references: params.references } : {}),
      options: { dryRun: true },
    }),
    signal: params.signal,
  });

  return readData<TImportConvertResult>(response);
}

/** Convert any other file server-side. Multipart; the browser sets the boundary. */
export async function convertImportFile(params: {
  workspaceId: string;
  file: File;
  signal?: AbortSignal;
}): Promise<TImportConvertResult> {
  const formData = new FormData();
  formData.set("workspaceId", params.workspaceId);
  formData.set("file", params.file, params.file.name);

  const response = await fetch(CONVERT_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    body: formData,
    signal: params.signal,
  });

  return readData<TImportConvertResult>(response);
}

/** Persist the reviewed document. Always through the import route so every lane creates through one door. */
export async function createImportedSurvey(params: {
  workspaceId: string;
  document: Record<string, unknown>;
  references?: TSurveyExportReferences | null;
  name?: string;
}): Promise<{ id: string }> {
  const response = await fetch(IMPORT_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId: params.workspaceId,
      document: params.document,
      ...(params.references ? { references: params.references } : {}),
      ...(params.name ? { options: { name: params.name } } : {}),
    }),
  });

  const data = await readData<{ survey: { id: string }; report: TImportReport }>(response);
  return { id: data.survey.id };
}

/**
 * Parse a file the user dropped as JSON, or return `null` when it is not JSON. A leading BOM is
 * tolerated; anything else that fails to parse is left to the server to explain.
 */
export async function readImportFileAsJson(file: File): Promise<unknown | null> {
  const text = await file.text();
  const trimmed = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).trimStart();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return null;
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return null;
  }
}
