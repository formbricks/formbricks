import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElement } from "@formbricks/types/surveys/elements";

/**
 * The `singleUseId` parameter was removed with ENG-2758: it appended `?suId=` with no `suToken`, and
 * since single-use links are now bound to their survey by that signature, such a URL can never
 * validate. Its only caller never passed one. Build single-use links with
 * `generateSurveySingleUseLinkParams`, which returns both halves.
 */
export const copySurveyLink = (surveyUrl: string): string => surveyUrl;

/**
 * Derives a flat array of elements from the survey's blocks structure.
 * This is the client-side equivalent of the server-side getElementsFromBlocks.
 * @param blocks - Array of survey blocks
 * @returns An array of TSurveyElement (pure elements without block-level properties)
 */
export const getElementsFromBlocks = (blocks: TSurveyBlock[] | undefined): TSurveyElement[] =>
  blocks?.flatMap((block) => block.elements) ?? [];
