import type { TSurveyGenerationStreamEvent } from "@/app/api/internal/surveys/generate/lib/events";
import type { TV3SurveyGenerateBody } from "@/app/api/v3/surveys/generate/schemas";
import { parseV3ApiError } from "@/modules/api/lib/v3-client";
import { NdjsonParser } from "./ai-stream-parser";

const STREAM_ENDPOINT = "/api/internal/surveys/generate/stream";

/**
 * Read the survey-generation stream, handing each event to `onEvent` as it arrives.
 *
 * A pre-stream failure still comes back as `problem+json`, so a non-OK response throws a
 * `V3ApiError` exactly like the blocking endpoint — the caller's existing error handling covers it
 * unchanged. Failures *after* the body opened arrive as `error` events instead, because the status
 * code is already spent by then.
 */
export async function streamSurveyGeneration(
  body: TV3SurveyGenerateBody,
  {
    signal,
    onEvent,
  }: {
    signal: AbortSignal;
    onEvent: (event: TSurveyGenerationStreamEvent) => void;
  }
): Promise<void> {
  const response = await fetch(STREAM_ENDPOINT, {
    method: "POST",
    cache: "no-store",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    throw await parseV3ApiError(response);
  }

  if (!response.body) {
    throw new Error("The survey generation stream returned no body.");
  }

  const reader = response.body.getReader();
  // TextDecoder with { stream: true } rather than TextDecoderStream, so the line splitting stays a
  // pure string function that can be unit-tested without constructing a stream.
  const decoder = new TextDecoder();
  const parser = new NdjsonParser<TSurveyGenerationStreamEvent>();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      parser.push(decoder.decode(value, { stream: true })).forEach(onEvent);
    }

    parser.flush().forEach(onEvent);
  } finally {
    reader.releaseLock();
  }
}
