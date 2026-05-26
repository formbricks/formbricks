import { generateObject as generateObjectWithConfiguredModel } from "ai";
import { getAiModel } from "./provider";
import type { AIEnvironment, TGenerateObjectOptions, TGenerateObjectResult } from "./types";

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
