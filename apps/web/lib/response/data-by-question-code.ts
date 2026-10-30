import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";

/** `{ Question ID: question code }` for the coded questions of a survey. */
export const getQuestionCodes = (blocks: readonly TSurveyBlock[]): Record<string, string> => {
  const questionCodes: Record<string, string> = {};
  for (const element of getElementsFromBlocks(blocks as TSurveyBlock[])) {
    if ("code" in element && element.code) {
      questionCodes[element.id] = element.code;
    }
  }
  return questionCodes;
};

/**
 * Same values as `data`, keyed by question code instead of Question ID (ADR 0016), so a receiver that
 * can only read the response object's root (Make, Zapier) still gets the public names. Every coded question
 * is listed, `null` when nothing is stored; a question without a code has no entry and hidden fields stay in
 * `data` only. Null-prototype because a code may be `constructor` or `toString`.
 */
export const buildDataByQuestionCode = (
  data: Record<string, unknown>,
  questionCodes: Record<string, string>
): Record<string, unknown> => {
  const byCode: Record<string, unknown> = Object.create(null);
  for (const [elementId, code] of Object.entries(questionCodes)) {
    byCode[code] = data[elementId] ?? null;
  }
  return byCode;
};
