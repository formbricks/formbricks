import { Output, generateText } from "ai";
import { getAiModel } from "./provider";
import type { AIEnvironment, TGenerateObjectOptions, TGenerateObjectResult } from "./types";

export const generateObject = async <T = unknown>(
  options: TGenerateObjectOptions<T>,
  environment?: AIEnvironment
): Promise<TGenerateObjectResult<T>> => {
  const { schema, schemaName, schemaDescription, ...rest } = options;
  const request = {
    ...rest,
    model: getAiModel(environment),
    output: Output.object<T>({
      schema,
      ...(schemaName ? { name: schemaName } : {}),
      ...(schemaDescription ? { description: schemaDescription } : {}),
    }),
  } as Parameters<typeof generateText>[0];
  const result = await generateText(request);

  return { ...result, object: result.output as T } as TGenerateObjectResult<T>;
};
