import { Output, streamText } from "ai";
import { AIOutputTokenLimitError } from "./errors";
import { getAiModel } from "./provider";
import type {
  AIEnvironment,
  AIResolvedLanguageModel,
  TStreamObjectOptions,
  TStreamObjectResult,
} from "./types";

/**
 * Streaming counterpart to `generateObject`, built the same way — `streamText` + `Output.object`
 * rather than the SDK's own `streamObject` — so both share one path for provider resolution,
 * model wrapping and structured-output semantics.
 *
 * Synchronous on purpose: `streamText` does not await the provider, so returning a promise here
 * would imply the model had been reached and delay the first token by a microtask.
 */
export const streamObject = <T = unknown>(
  options: TStreamObjectOptions<T>,
  environment?: AIEnvironment,
  wrapModel?: (model: AIResolvedLanguageModel) => AIResolvedLanguageModel
): TStreamObjectResult<T> => {
  const { schema, schemaName, schemaDescription, output: _output, onError, ...textOptions } = options;
  const model = getAiModel(environment);

  // The real provider failure (APICallError / RetryError) reaches user code only through `onError`.
  // When no step was recorded the SDK rejects `finishReason` with a bare NoOutputGeneratedError,
  // which `classifyAIProviderError` cannot read a 429 out of — so capture the error here or the
  // quota mapping every caller relies on silently never fires.
  let providerError: unknown;

  const request = {
    ...textOptions,
    model: wrapModel ? wrapModel(model as AIResolvedLanguageModel) : model,
    output: Output.object<T>({
      schema,
      name: schemaName,
      description: schemaDescription,
    }),
    onError: async (event: { error: unknown }) => {
      providerError ??= event.error;
      await onError?.(event);
    },
  } as Parameters<typeof streamText>[0];

  const result = streamText(request);

  // Must be read before anything else touches `result`: every promise-like getter routes through
  // `finalStep`, which calls `consumeStream()`, and the SDK's `teeStream()` reassigns `baseStream`
  // as it tees. Reading the partial stream after them loses chunks.
  const partialObjectStream = result.partialOutputStream as TStreamObjectResult<T>["partialObjectStream"];

  const completion = (async (): Promise<T> => {
    try {
      // Mirrors `generateObject`: with `output: Output.object(...)` the SDK only parses the output
      // when the generation finished with "stop"; on "length" the getter throws a bare
      // NoOutputGeneratedError, so raise the dedicated error first.
      if ((await result.finishReason) === "length") {
        const usage = await result.usage;
        throw new AIOutputTokenLimitError({
          maxOutputTokens: textOptions.maxOutputTokens,
          outputTokens: usage.outputTokens,
          reasoningTokens: usage.outputTokenDetails.reasoningTokens,
        });
      }

      return (await result.output) as T;
    } catch (error) {
      // `providerError` is only set when the stream carried an error part, so the token-limit error
      // thrown just above passes through unchanged.
      throw providerError ?? error;
    }
  })();

  // A caller may legitimately never await this — the client aborted, so only the partial stream was
  // ever consumed. Keep that from surfacing as an unhandled rejection while still handing back the
  // rejecting promise.
  completion.catch(() => undefined);

  return { partialObjectStream, completion };
};
