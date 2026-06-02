import {
  type GenerateObjectResult,
  type generateObject as generateObjectFromSdk,
  generateObject as generateObjectWithConfiguredModel,
} from "ai";
import { getAiModel } from "./provider";
import type { AIEnvironment } from "./types";

// `T` parameterises the wrapper so callers can declare the inferred object
// shape on the consuming side; the SDK options themselves stay schema-agnostic.
export type TGenerateObjectOptions<_T = unknown> = Omit<
  Parameters<typeof generateObjectFromSdk>[0],
  "model"
> & { schema?: unknown };

export type TGenerateObjectResult<T> = GenerateObjectResult<T>;

/**
 * Wrapper around the AI SDK's `generateObject` that forces the active model.
 * Use this when the LLM output needs to conform to a schema — Gemini and
 * other models follow JSON-shape instructions much more reliably under
 * structured-output mode than via free-form `generateText` prompts.
 */
export const generateObject = async <T>(
  options: TGenerateObjectOptions<T>,
  environment?: AIEnvironment
): Promise<TGenerateObjectResult<T>> => {
  const request = {
    ...options,
    model: getAiModel(environment),
  } as Parameters<typeof generateObjectWithConfiguredModel>[0];

  return (await generateObjectWithConfiguredModel(request)) as TGenerateObjectResult<T>;
};
