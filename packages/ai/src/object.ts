import { Output, generateText } from "ai";
import { getAiModel } from "./provider";
import type { AIEnvironment, TGenerateObjectOptions, TGenerateObjectResult } from "./types";

export const generateObject = async <T = unknown>(
  options: TGenerateObjectOptions<T>,
  environment?: AIEnvironment
): Promise<TGenerateObjectResult<T>> => {
  const { schema, schemaName, schemaDescription, output: _output, ...textOptions } = options;
  const request = {
    ...textOptions,
    model: getAiModel(environment),
    output: Output.object<T>({
      schema,
      name: schemaName,
      description: schemaDescription,
    }),
  } as Parameters<typeof generateText>[0];

  const result = await generateText(request);
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
