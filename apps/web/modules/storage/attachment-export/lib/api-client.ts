import type { TResponseFilterCriteria } from "@formbricks/types/responses";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TAttachmentExport } from "../types";

/**
 * Client fetchers for the attachment export routes (ENG-6862). Each throws a parsed `V3ApiError` on a
 * non-2xx response.
 */

const MUTATION_TIMEOUT_MS = 30_000;

const basePath = (surveyId: string) => `/api/surveys/${surveyId}/attachment-exports`;

async function readData<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw await parseV3ApiError(response);
  }
  return ((await response.json()) as { data: T }).data;
}

/**
 * Starts an export. `created` is false when the caller already had one queued or running for this
 * survey: that one comes back instead of a new one starting.
 */
export async function createAttachmentExport(params: {
  surveyId: string;
  filterCriteria?: TResponseFilterCriteria;
}): Promise<{ attachmentExport: TAttachmentExport; created: boolean }> {
  const response = await fetch(basePath(params.surveyId), {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params.filterCriteria ? { filterCriteria: params.filterCriteria } : {}),
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });
  const attachmentExport = await readData<TAttachmentExport>(response);
  return { attachmentExport, created: response.status === 202 };
}

/** A presigned URL for a completed export, valid for a few hours; minted fresh on every call. */
export async function getAttachmentExportDownloadUrl(params: {
  surveyId: string;
  exportId: string;
}): Promise<string> {
  const response = await fetch(`${basePath(params.surveyId)}/${params.exportId}/download`, {
    method: "GET",
    cache: "no-store",
    signal: AbortSignal.timeout(MUTATION_TIMEOUT_MS),
  });
  return (await readData<{ url: string }>(response)).url;
}
