import { generateText as generateTextWithConfiguredModel } from "ai";
import { getAiModel } from "./provider";
import type { AIEnvironment, TGenerateTextOptions, TGenerateTextResult } from "./types";

export const generateText = async (
  options: TGenerateTextOptions,
  environment?: AIEnvironment
): Promise<TGenerateTextResult> => {
  const request = {
    ...options,
    model: getAiModel(environment),
  } as Parameters<typeof generateTextWithConfiguredModel>[0];

  return generateTextWithConfiguredModel(request);
};
