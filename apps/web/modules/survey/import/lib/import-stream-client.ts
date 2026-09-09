import type { TSurveyImportStreamEvent } from "@/app/api/internal/surveys/import/lib/events";
import { streamSurveyGeneration } from "@/modules/survey/components/template-list/lib/ai-generate-stream-client";

export const SURVEY_IMPORT_STREAM_ENDPOINT = "/api/internal/surveys/import/stream";

/**
 * Stream a file's conversion. A pre-stream failure (no AI, budget spent, unsupported file) throws a
 * `V3ApiError` like the blocking convert call; failures after the body opened arrive as `error`
 * events. Unknown event types are passed through untouched for forward compatibility.
 */
export async function streamImportConversion(
  body: FormData,
  { signal, onEvent }: { signal: AbortSignal; onEvent: (event: TSurveyImportStreamEvent) => void }
): Promise<void> {
  await streamSurveyGeneration<TSurveyImportStreamEvent>(body, {
    signal,
    endpoint: SURVEY_IMPORT_STREAM_ENDPOINT,
    onEvent: (event) => onEvent(event as TSurveyImportStreamEvent),
  });
}

/** The multipart body the import stream and the blocking convert route both accept. */
export function buildImportFormData(params: {
  workspaceId: string;
  file: File;
  language?: string;
}): FormData {
  const formData = new FormData();
  formData.set("workspaceId", params.workspaceId);
  if (params.language) formData.set("language", params.language);
  formData.set("file", params.file, params.file.name);
  return formData;
}
