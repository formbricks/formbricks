import { getTextContent } from "@formbricks/types/surveys/validation";
import { isPlainObject } from "@/app/api/v3/surveys/guards";
import type { TSurveyImportPipelineIssue } from "@/modules/survey/import/core/report";

/**
 * What an Update takes away from a survey that already has responses (ENG-6851): one warning per
 * question the file does not have, and per option, matrix row or column a question it keeps loses.
 * Their answers stay in the database but stop showing in the summary, which is what the editor warns
 * about before a change to a survey with responses. A removed question goes ahead with its warning; a
 * removed option of a survey that has left draft is refused before this runs, by the published lock
 * (`getUpdateRefusal`), so its warning shows only for a survey taken back to draft.
 *
 * Questions and options are matched by id, wherever the file moved them. The stored blocks keep their
 * texts under `default`; the draft's are keyed by language code, and only its ids are read. Pure: the
 * caller decides whether the survey has responses.
 */

const OPTION_LISTS = ["choices", "rows", "columns"] as const;

const arrayOf = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const idOf = (value: unknown): string | null =>
  isPlainObject(value) && typeof value.id === "string" ? value.id : null;

/** A stored text's default-language value as plain text, or `""`. */
const defaultText = (text: unknown): string =>
  isPlainObject(text) && typeof text.default === "string" ? getTextContent(text.default) : "";

/** Every option id an element holds, across its choices, matrix rows and columns. */
const optionIdsOf = (element: Record<string, unknown>): Set<string> =>
  new Set(
    OPTION_LISTS.flatMap((list) => arrayOf(element[list]).map(idOf)).filter((id): id is string => id !== null)
  );

/** The draft's elements by id, from blocks of any shape: what is not an element is no element. */
const draftElementsById = (draftBlocks: unknown): Map<string, Record<string, unknown>> => {
  const elements = new Map<string, Record<string, unknown>>();
  for (const block of arrayOf(draftBlocks)) {
    if (!isPlainObject(block)) continue;
    for (const element of arrayOf(block.elements)) {
      const id = idOf(element);
      if (id !== null && isPlainObject(element)) elements.set(id, element);
    }
  }
  return elements;
};

/** The options of a stored question that the draft's version of it no longer has, one issue each. */
const removedOptions = (
  stored: Record<string, unknown>,
  draftElement: Record<string, unknown>,
  questionTag: string
): TSurveyImportPipelineIssue[] => {
  const keptOptions = optionIdsOf(draftElement);
  const issues: TSurveyImportPipelineIssue[] = [];
  for (const option of OPTION_LISTS.flatMap((list) => arrayOf(stored[list]))) {
    const optionId = idOf(option);
    if (optionId === null || keptOptions.has(optionId)) continue;
    // A picture choice has no label; its id is what the editor shows for it.
    const label = isPlainObject(option) ? defaultText(option.label) : "";
    issues.push({
      code: "option_removed",
      severity: "warning",
      questionTag,
      params: { option: label || optionId },
    });
  }
  return issues;
};

export const getFormbricksFileRemovals = (
  storedBlocks: unknown,
  draftBlocks: unknown
): TSurveyImportPipelineIssue[] => {
  const kept = draftElementsById(draftBlocks);
  const storedElements = arrayOf(storedBlocks).flatMap((block) =>
    isPlainObject(block) ? arrayOf(block.elements) : []
  );

  return storedElements.flatMap((stored): TSurveyImportPipelineIssue[] => {
    if (!isPlainObject(stored) || typeof stored.id !== "string") return [];
    const questionTag = stored.id;
    const draftElement = kept.get(questionTag);
    if (draftElement) return removedOptions(stored, draftElement, questionTag);
    return [
      {
        code: "question_removed",
        severity: "warning",
        questionTag,
        params: { headline: defaultText(stored.headline) },
      },
    ];
  });
};
