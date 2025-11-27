import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElement } from "@formbricks/types/surveys/elements";

export const copySurveyLink = (surveyUrl: string, singleUseId?: string): string => {
  return singleUseId ? `${surveyUrl}?suId=${singleUseId}` : surveyUrl;
};

/**
 * Derives a flat array of elements from the survey's blocks structure.
 * This is the client-side equivalent of the server-side getElementsFromBlocks.
 * @param blocks - Array of survey blocks
 * @returns An array of TSurveyElement (pure elements without block-level properties)
 */
export const getElementsFromBlocks = (blocks: TSurveyBlock[] | undefined): TSurveyElement[] =>
  blocks?.flatMap((block) => block.elements) ?? [];
