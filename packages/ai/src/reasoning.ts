import type { TGenerateObjectOptions } from "./types";

/**
 * The lowest thinking a Gemini model on Vertex accepts, for `lowReasoning`. Each family takes its own
 * setting, and the wrong one is a 400 (Vertex "Thinking" docs):
 *
 * - Gemini 2.5 takes a token budget: 0 turns thinking off on Flash and Flash-Lite; Pro cannot turn it
 *   off and takes 128 at the least. A thinking level is an error there.
 * - Gemini 3 and later take a level, and every one of them accepts `low` (Pro has no `minimal`). A
 *   budget is deprecated there and intermittently an error, and sending both is one.
 *
 * `undefined` for a model this cannot place, or one without thinking (before 2.5): left as configured.
 */
export const geminiLowThinkingConfig = (
  model: string
): { thinkingBudget: number } | { thinkingLevel: "low" } | undefined => {
  // A full resource name (`publishers/google/models/gemini-2.5-pro`) ends in the model's id.
  const id = model.trim().toLowerCase().split("/").pop() ?? "";
  const version = /^gemini-(\d+)(?:\.(\d+))?/.exec(id);
  if (!version) return undefined;
  const major = Number(version[1]);
  // `gemini-2` with no minor version is NaN here, and placed nowhere.
  const minor = Number(version[2]);
  if (major >= 3) return { thinkingLevel: "low" };
  if (major === 2 && minor === 5) return { thinkingBudget: id.includes("-pro") ? 128 : 0 };
  return undefined;
};

/**
 * `providerOptions` with the model's thinking turned down, for a task that needs none: extraction
 * rather than reasoning, where thinking only spends the call's output tokens (which it counts against)
 * and its time. Only the Google adapter maps it; on Vertex it reads `vertex` options, else `google`
 * ones, so the setting goes under `vertex` on top of whichever the caller gave. A caller that set its
 * own `thinkingConfig` keeps it whole: mixing a budget with a level is a 400.
 */
export const withLowReasoning = (
  providerOptions: TGenerateObjectOptions["providerOptions"],
  provider: string | null,
  model: string | undefined
): TGenerateObjectOptions["providerOptions"] => {
  if (provider !== "google" || !model) return providerOptions;
  const thinking = geminiLowThinkingConfig(model);
  if (!thinking) return providerOptions;
  const own = providerOptions?.vertex ?? providerOptions?.google ?? {};
  if (own.thinkingConfig !== undefined) return providerOptions;
  return { ...providerOptions, vertex: { ...own, thinkingConfig: thinking } };
};
