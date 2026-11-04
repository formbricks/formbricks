import type { TResponseData } from "@formbricks/types/responses";
import type { TSurveyBlock } from "@formbricks/types/surveys/blocks";

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
