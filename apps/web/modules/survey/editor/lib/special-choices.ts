import type { TSurveyElementChoice } from "@formbricks/types/surveys/elements";
import type { TShuffleOption } from "@formbricks/types/surveys/types";

// "Other" and "None" are the special choices: they carry fixed ids and always sit after the regular
// choices, in that order, so the renderer can keep them last when it shuffles.
const isSpecialChoiceId = (id: string): boolean => id === "other" || id === "none";

export const hasSpecialChoice = (choices: TSurveyElementChoice[]): boolean =>
  choices.some((choice) => isSpecialChoiceId(choice.id));

/** Orders choices as [regular choices, "Other", "None"]. */
export const ensureSpecialChoicesOrder = <T extends TSurveyElementChoice>(choices: T[]): T[] => {
  const regularChoices = choices.filter((choice) => !isSpecialChoiceId(choice.id));
  const otherChoice = choices.find((choice) => choice.id === "other");
  const noneChoice = choices.find((choice) => choice.id === "none");
  return [...regularChoices, ...(otherChoice ? [otherChoice] : []), ...(noneChoice ? [noneChoice] : [])];
};

/**
 * A shuffle that moves the last choice would move a special choice out of last place, so adding one
 * switches to the matching "except last" mode. Returns undefined when the mode can stay as it is.
 */
export const getShuffleOptionAfterAddingSpecialChoice = (
  current: TShuffleOption | undefined
): TShuffleOption | undefined => {
  if (current === "all") return "exceptLast";
  if (current === "reverseOrderOccasionally") return "reverseOrderExceptLast";
  return undefined;
};

/**
 * Inverse of `getShuffleOptionAfterAddingSpecialChoice`, applied once the last special choice is
 * removed. Returns undefined when the mode can stay as it is.
 */
export const getShuffleOptionAfterRemovingSpecialChoice = (
  current: TShuffleOption | undefined,
  remainingChoices: TSurveyElementChoice[]
): TShuffleOption | undefined => {
  if (hasSpecialChoice(remainingChoices)) return undefined;
  if (current === "exceptLast") return "all";
  if (current === "reverseOrderExceptLast") return "reverseOrderOccasionally";
  return undefined;
};
