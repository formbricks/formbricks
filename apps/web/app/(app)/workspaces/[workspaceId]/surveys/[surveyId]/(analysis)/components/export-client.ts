import type { TExportColumnGroup } from "@/lib/analysis-export/column-selection";
import type { TExcelSizeVerdict } from "@/lib/analysis-export/excel-size";
import type { TExportRequest } from "@/lib/analysis-export/export-request";

/** The export route's refusal, with the reason it gave when it gave one. */
export class ExportRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ExportRequestError";
    this.status = status;
  }
}

type TFetch = typeof fetch;

const exportUrl = (surveyId: string, dryRun = false): string =>
  `/api/surveys/${surveyId}/export${dryRun ? "?dryRun=true" : ""}`;

const post = (fetchImpl: TFetch, url: string, request: TExportRequest, signal: AbortSignal) =>
  fetchImpl(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
    signal,
  });

const failure = async (response: Response): Promise<ExportRequestError> => {
  let detail = "";
  try {
    const problem = (await response.json()) as { detail?: unknown };
    if (typeof problem.detail === "string") detail = problem.detail;
  } catch {
    // Not a problem document (a proxy page, a dropped body): the status is all there is.
  }
  return new ExportRequestError(detail || `The export failed (${response.status})`, response.status);
};

export const parseFileName = (contentDisposition: string | null): string | null =>
  /filename="([^"]+)"/.exec(contentDisposition ?? "")?.[1] ?? null;

/**
 * Requests the file and reads it to the end. The server streams CSV and zip, so `onProgress` follows the
 * bytes as they arrive; Excel is built whole on the server and arrives in one go. The file is held as a
 * Blob in the tab, which the browser backs with disk past a threshold.
 */
export const requestExport = async ({
  surveyId,
  request,
  signal,
  onProgress,
  fetchImpl = fetch,
}: {
  surveyId: string;
  request: TExportRequest;
  signal: AbortSignal;
  onProgress?: (bytesReceived: number) => void;
  fetchImpl?: TFetch;
}): Promise<{ blob: Blob; fileName: string | null }> => {
  const response = await post(fetchImpl, exportUrl(surveyId), request, signal);
  if (!response.ok) throw await failure(response);

  const type = response.headers.get("Content-Type") ?? undefined;
  const fileName = parseFileName(response.headers.get("Content-Disposition"));
  if (!response.body) return { blob: await response.blob(), fileName };

  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array<ArrayBuffer>);
    received += value.byteLength;
    onProgress?.(received);
  }
  return { blob: new Blob(chunks, { type }), fileName };
};

export type TExportCounts = {
  included: number;
  lowQualityLeftOut: number;
  /** Every response of the survey, filter or not. */
  total: number;
  /** The Include columns list for this export. */
  columnGroups: TExportColumnGroup[];
  kind: "standard" | "analysis";
  /** Excel's size for this selection against the cap. `null` for the Standard export. */
  excel: TExcelSizeVerdict | null;
};

/** The numbers behind the modal's "Include X responses" line. */
export const fetchExportCounts = async ({
  surveyId,
  request,
  signal,
  fetchImpl = fetch,
}: {
  surveyId: string;
  request: TExportRequest;
  signal?: AbortSignal;
  fetchImpl?: TFetch;
}): Promise<TExportCounts> => {
  const response = await post(
    fetchImpl,
    exportUrl(surveyId, true),
    request,
    signal ?? new AbortController().signal
  );
  if (!response.ok) throw await failure(response);
  return ((await response.json()) as { data: TExportCounts }).data;
};

/** Hands a downloaded file to the browser's own download. */
export const saveBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoked on the next turn: some browsers start the download after the click returns.
  setTimeout(() => URL.revokeObjectURL(url), 0);
};

/** A byte count for people: `340 KB`, `2.4 MB`. */
export const formatBytes = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
