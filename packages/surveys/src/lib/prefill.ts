import type { TResponseData } from "@formbricks/types/responses";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { type TPreselections, resolvePreselectedAnswer } from "@formbricks/types/surveys/preselect-answer";

/**
 * What a page does with URL prefill when it mounts: the prefilled answers it applies, and whether
 * `skipPrefilled` submits it straight away.
 *
 * It reads the block's every element, not only those shown on the first render: a show-if hides a
 * follow-up until its answer is in, so a prefill that would reveal a required follow-up must keep the
 * page open for it rather than submit past it.
 */
export const getBlockPrefill = (
  { elements }: Pick<TSurveyBlock, "elements">,
  prefilledResponseData: TResponseData | undefined,
  skipPrefilled: boolean | undefined
): { data: TResponseData; autoSubmit: boolean } => {
  const data: TResponseData = {};
  if (!prefilledResponseData) return { data, autoSubmit: false };

  for (const element of elements) {
    if (prefilledResponseData[element.id] !== undefined) data[element.id] = prefilledResponseData[element.id];
  }
  const hasAny = Object.keys(data).length > 0;
  const allPrefilled = elements.every((element) => prefilledResponseData[element.id] !== undefined);

  return { data, autoSubmit: Boolean(skipPrefilled) && hasAny && allPrefilled };
};

/**
 * The answers a page opens with from rules that pre-selected them (ENG-7437): for each of the
 * block's questions with a pre-selection and no answer yet, that pre-selection in the respondent's
 * language. A question the respondent already answered (they came Back, or a URL prefill gave it)
 * keeps that answer; a pre-selection that no longer fits its question (an option deleted since) gives
 * nothing.
 *
 * The answers are the page's like any other: the respondent can change them, and the response stores
 * what the page submits. A page that is never shown submits nothing, so its pre-selections are never
 * an answer.
 */
export const getBlockPreselection = (
  { elements }: Pick<TSurveyBlock, "elements">,
  preselections: TPreselections,
  answers: TResponseData,
  languageId: string
): TResponseData => {
  const data: TResponseData = {};
  for (const element of elements) {
    if (!Object.hasOwn(preselections, element.id) || answers[element.id] !== undefined) continue;
    const answer = resolvePreselectedAnswer(element, preselections[element.id], languageId);
    if (answer !== undefined) data[element.id] = answer;
  }
  return data;
};
