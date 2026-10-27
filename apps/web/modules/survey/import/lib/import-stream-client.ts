import type { TQsfImportStreamEvent } from "@/app/api/internal/surveys/import/lib/events";
import type { TQsfImportStreamBody } from "@/app/api/internal/surveys/import/lib/schemas";
import { V3ApiError, parseV3ApiError } from "@/modules/api/lib/v3-client";
import { readSurveyDraftStream } from "@/modules/survey/components/template-list/lib/ai-generate-stream-client";

export const QSF_IMPORT_STREAM_ENDPOINT = "/api/internal/surveys/import/stream";

/** A refusal answered before the stream opened, plus the `Retry-After` header the problem body lacks. */
export class QsfImportRequestError extends V3ApiError {
  readonly retryAfterSeconds: number | null;

  constructor(error: V3ApiError, retryAfterSeconds: number | null) {
    super({
      status: error.status,
      detail: error.detail,
      code: error.code,
      requestId: error.requestId,
      invalid_params: error.invalid_params,
    });
    this.name = "QsfImportRequestError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

/** The server sends `Retry-After` in seconds; anything else is ignored rather than guessed at. */
export const parseRetryAfterSeconds = (value: string | null): number | null => {
  if (value === null || value.trim() === "") return null;
  const seconds = Number(value);
  return Number.isSafeInteger(seconds) && seconds >= 0 ? seconds : null;
};

/**
 * Run an import, handing each NDJSON event to `onEvent`. A refusal before the stream opened throws a
 * `QsfImportRequestError`; a failure after it arrives as an `error` event, like Create with AI's stream.
 */
export async function streamQsfImport(
  body: TQsfImportStreamBody,
  { signal, onEvent }: { signal: AbortSignal; onEvent: (event: TQsfImportStreamEvent) => void }
): Promise<void> {
  const response = await fetch(QSF_IMPORT_STREAM_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const retryAfterSeconds = parseRetryAfterSeconds(response.headers.get("Retry-After"));
    throw new QsfImportRequestError(await parseV3ApiError(response), retryAfterSeconds);
  }

  await readSurveyDraftStream<TQsfImportStreamEvent>(response, onEvent);
}
