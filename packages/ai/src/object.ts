import { Output, generateText } from "ai";
import { getAiModel } from "./provider";
import type { AIEnvironment, TGenerateObjectOptions, TGenerateObjectResult } from "./types";

export const generateObject = async <T>(
  options: TGenerateObjectOptions<T>,
  environment?: AIEnvironment
): Promise<TGenerateObjectResult<T>> => {
  const { schema, ...rest } = options;
  const request = {
    ...rest,
    model: getAiModel(environment),
    output: Output.object<T>({ schema }),
  } as Parameters<typeof generateText>[0];
  const result = await generateText(request);

  return { ...result, object: result.output as T } as TGenerateObjectResult<T>;
};
