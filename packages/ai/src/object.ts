import { Output, generateText } from "ai";
import { AIOutputTokenLimitError } from "./errors";
import { getAiModel } from "./provider";
import { getOpenAICompatibleProviderName } from "./providers/openai-compatible";
import { getAIEnvironment } from "./shared";
import type {
  AIEnvironment,
  AIResolvedLanguageModel,
  TGenerateObjectOptions,
  TGenerateObjectResult,
} from "./types";

/**
 * `providerOptions` with strict JSON-schema decoding turned off, under every key a strict-decoding
 * adapter reads its options from: `openai` and `azure` (the Azure adapter reads either), and the
 * OpenAI-compatible adapter's own name. A key no configured adapter reads is ignored.
 */
const withoutStrictSchema = (
  providerOptions: TGenerateObjectOptions["providerOptions"],
  environment?: AIEnvironment
): NonNullable<TGenerateObjectOptions["providerOptions"]> => {
  const keys = new Set([
    "openai",
    "azure",
    "openaiCompatible",
    getOpenAICompatibleProviderName(getAIEnvironment(environment)),
  ]);
  const options = { ...providerOptions };
  for (const key of keys) {
    options[key] = { ...options[key], strictJsonSchema: false };
  }
  return options;
};

export const generateObject = async <T = unknown>(
  options: TGenerateObjectOptions<T>,
  environment?: AIEnvironment,
  wrapModel?: (model: AIResolvedLanguageModel) => AIResolvedLanguageModel
): Promise<TGenerateObjectResult<T>> => {
  const { schema, schemaName, schemaDescription, output: _output, strictSchema, ...textOptions } = options;
  const model = getAiModel(environment);
  const request = {
    ...textOptions,
    ...(strictSchema === false
      ? { providerOptions: withoutStrictSchema(textOptions.providerOptions, environment) }
      : {}),
    model: wrapModel ? wrapModel(model as AIResolvedLanguageModel) : model,
    output: Output.object<T>({
      schema,
      name: schemaName,
      description: schemaDescription,
    }),
  } as Parameters<typeof generateText>[0];

  const result = await generateText(request);

  // With `output: Output.object(...)`, the AI SDK only parses `result.output` when the generation
  // finished with "stop"; on "length" the getter throws a bare NoOutputGeneratedError. Throw a
  // dedicated error first so callers can tell "output token limit reached" apart from other failures.
  if (result.finishReason === "length") {
    throw new AIOutputTokenLimitError({
      maxOutputTokens: textOptions.maxOutputTokens,
      outputTokens: result.usage.outputTokens,
      reasoningTokens: result.usage.outputTokenDetails.reasoningTokens,
    });
  }

  const object = result.output as T;

  return {
    object,
    reasoning: result.reasoningText,
    finishReason: result.finishReason,
    usage: result.usage,
    warnings: result.warnings,
    request: result.request,
    response: result.response,
    providerMetadata: result.providerMetadata,
    toJsonResponse(init?: ResponseInit) {
      const headers = new Headers(init?.headers);
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json; charset=utf-8");
      }

      return new Response(JSON.stringify(object), {
        ...init,
        headers,
      });
    },
  };
};
