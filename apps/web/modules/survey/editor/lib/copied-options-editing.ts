import { getCopiedOptionIds, getOptionsCopiedFrom } from "@formbricks/types/surveys/copied-options";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Copied options in the editor (ENG-6938). The editor no longer sets them up (P70): a survey can still
 * carry `optionsCopiedFrom` written through the API, and the Recode section shows which codes are the
 * source's. The copying itself lives in `@formbricks/types/surveys/copied-options`.
 */

const findElement = (survey: TSurvey, id: unknown): TSurveyElement | undefined =>
  typeof id === "string"
    ? survey.blocks.flatMap((block) => block.elements).find((element) => element.id === id)
    : undefined;

/**
 * For the Recode section: the question `element` copies its options from, and which of its options
 * are copies, whose codes are the source's and read-only here. `null` when it copies nothing.
 */
export const getCopiedOptionsSource = (
  survey: TSurvey,
  element: TSurveyElement
): { source: TSurveyElement; copiedIds: Set<string> } | null => {
  const source = findElement(survey, getOptionsCopiedFrom(element));
  if (!source) return null;
  return { source, copiedIds: getCopiedOptionIds(source, element) };
};
