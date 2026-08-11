import { generateText as generateTextWithConfiguredModel } from "ai";
import { getAiModel } from "./provider";
import type {
  AIEnvironment,
  AIResolvedLanguageModel,
  TGenerateTextOptions,
  TGenerateTextResult,
} from "./types";

export const generateText = async (
  options: TGenerateTextOptions,
  environment?: AIEnvironment,
  wrapModel?: (model: AIResolvedLanguageModel) => AIResolvedLanguageModel
): Promise<TGenerateTextResult> => {
  const model = getAiModel(environment);
  const request = {
    ...options,
    model: wrapModel ? wrapModel(model as AIResolvedLanguageModel) : model,
  } as Parameters<typeof generateTextWithConfiguredModel>[0];

  return generateTextWithConfiguredModel(request);
};
