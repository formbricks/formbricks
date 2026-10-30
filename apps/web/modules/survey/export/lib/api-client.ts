import { getContentDispositionFileName } from "@/lib/utils/file-download";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import type { TSurveyExportFormat } from "./formats";

/** The name a download is saved under when the response doesn't name it. */
const FALLBACK_FILE_NAMES: Record<TSurveyExportFormat, string> = {
  json: "survey.formbricks.json",
  xlsx: "survey.xlsx",
};

/**
 * A survey's export, fetched rather than linked: a refusal (a rate limit, a survey the caller can no
 * longer see) is problem JSON, which a plain download link would save as the file. Thrown as a
 * `V3ApiError` then; on success, the body and the file name the server gave it.
 */
export async function fetchSurveyExport({
  surveyId,
  format,
  signal,
}: {
  surveyId: string;
  format: TSurveyExportFormat;
  signal?: AbortSignal;
}): Promise<{ blob: Blob; fileName: string }> {
  const response = await fetch(
    `/api/internal/surveys/${encodeURIComponent(surveyId)}/export?${new URLSearchParams({ format })}`,
    { method: "GET", cache: "no-store", signal }
  );
  if (!response.ok) throw await parseV3ApiError(response);
  return {
    blob: await response.blob(),
    fileName:
      getContentDispositionFileName(response.headers.get("Content-Disposition")) ??
      FALLBACK_FILE_NAMES[format],
  };
}
