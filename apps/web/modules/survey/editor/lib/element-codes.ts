import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TCodeIssue, validateSurveyCodes } from "@formbricks/types/surveys/codes";
import { collectDeclaredFieldNames } from "@formbricks/types/surveys/declared-field-guard";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Editor-side view of question codes and answer codes (ADR 0016, GLOSSARY "Recoding and exports").
 * The rules live in `@formbricks/types/surveys/codes`; this module only places each issue on the
 * field, question and block that shows it, and builds the updates the Recode section sends.
 */

export type TOptionListKey = "choices" | "rows" | "columns";

export type TElementCodeIssues = {
  question?: TCodeIssue;
  /** Keyed by `optionIssueKey(list, optionId)`. */
  options: Map<string, TCodeIssue>;
};

export const optionIssueKey = (list: TOptionListKey, optionId: string): string => `${list}:${optionId}`;

type TCodedOption = { id: string; code?: string; label?: unknown; imageUrl?: string };

const OPTION_LISTS_BY_TYPE: Record<string, readonly TOptionListKey[]> = {
  multipleChoiceSingle: ["choices"],
  multipleChoiceMulti: ["choices"],
  ranking: ["choices"],
  pictureSelection: ["choices"],
  matrix: ["rows", "columns"],
};

/** The lists of an element whose entries carry an answer code. Scale questions have none. */
export const getOptionCodeLists = (
  element: TSurveyElement
): { key: TOptionListKey; options: TCodedOption[] }[] =>
  (OPTION_LISTS_BY_TYPE[element.type] ?? []).map((key) => ({
    key,
    options: ((element as unknown as Record<string, TCodedOption[] | undefined>)[key] ??
      []) as TCodedOption[],
  }));

/** Whether the element has a question code at all: every answerable element, not CTA. */
export const hasQuestionCode = (element: TSurveyElement): boolean => element.type !== "cta";

/**
 * A clash between two questions is reported on the later one only. The earlier one is marked too, with the
 * clash pointing back, so the author sees both sides and the block of either one reads as needing attention.
 */
const markEarlierSide = (
  result: Map<string, TElementCodeIssues>,
  issue: TCodeIssue,
  laterElementId: string
): void => {
  const isQuestionClash = issue.kind === "duplicate_question_code" || issue.kind === "clashes_export_column";
  if (!isQuestionClash || !issue.clashesWith) return;
  const earlier: TElementCodeIssues = result.get(issue.clashesWith) ?? { options: new Map() };
  earlier.question ??= { ...issue, clashesWith: laterElementId };
  result.set(issue.clashesWith, earlier);
};

const issueCache = new WeakMap<object, ReadonlyMap<string, TElementCodeIssues>>();

/**
 * Every code issue of the survey, grouped per element id. Survey snapshots are immutable, so the
 * result is cached on the object: each card of a re-render asks about the same two snapshots.
 */
export const getElementCodeIssues = (survey: TSurvey): ReadonlyMap<string, TElementCodeIssues> => {
  const cached = issueCache.get(survey);
  if (cached) return cached;

  const result = new Map<string, TElementCodeIssues>();
  for (const issue of validateSurveyCodes({
    blocks: survey.blocks,
    // The working copy's rows, as the server reads them: the legacy keys are forwarded untouched from mount
    // and lag behind an Embedded Data card edit, so a new clash would only fail the autosave.
    embeddedDataNames: collectDeclaredFieldNames(survey),
  })) {
    const [, blockIdx, , elementIdx, listKey, optionIdx] = issue.path;
    const element = survey.blocks[blockIdx as number]?.elements[elementIdx as number];
    if (!element) continue;

    const entry: TElementCodeIssues = result.get(element.id) ?? { options: new Map() };
    if (listKey === "code" || listKey === undefined) {
      entry.question = issue;
      markEarlierSide(result, issue, element.id);
    } else {
      const option = getOptionCodeLists(element).find((list) => list.key === listKey)?.options[
        optionIdx as number
      ];
      if (option) entry.options.set(optionIssueKey(listKey as TOptionListKey, option.id), issue);
    }
    result.set(element.id, entry);
  }

  issueCache.set(survey, result);
  return result;
};

/** Ids of the elements that have a code problem, for the red question and block state. */
export const getInvalidCodeElementIds = (survey: TSurvey): ReadonlySet<string> =>
  new Set(getElementCodeIssues(survey).keys());

/**
 * A string that differs exactly when what a block's cards show about codes differs. The memoized
 * block card compares it, so a clash caused by an edit in another block still re-renders this one.
 */
export const getBlockCodeIssueKey = (survey: TSurvey, block: TSurveyBlock): string => {
  const issues = getElementCodeIssues(survey);
  return block.elements
    .flatMap((element) => {
      const entry = issues.get(element.id);
      if (!entry) return [];
      const issueKey = (issue: TCodeIssue) =>
        `${issue.kind}:${issue.reason ?? ""}:${issue.clashesWith ?? ""}`;
      return [
        `${element.id}|${entry.question ? issueKey(entry.question) : ""}|${[...entry.options]
          .map(([key, issue]) => `${key}=${issueKey(issue)}`)
          .join(",")}`,
      ];
    })
    .join(";");
};

/**
 * The empty string means "not coded yet". The editor's write path (`withFilledCodes`, ENG-6782)
 * then gives the question its default code at once, so clearing a code is how you ask for the default.
 */
export const setElementCode = (value: string): { code: string | undefined } => ({
  code: value === "" ? undefined : value,
});

export const setOptionCode = (
  element: TSurveyElement,
  list: TOptionListKey,
  optionId: string,
  value: string
): Partial<Record<TOptionListKey, TCodedOption[]>> => {
  const options = getOptionCodeLists(element).find((entry) => entry.key === list)?.options ?? [];
  return {
    [list]: options.map((option) =>
      option.id === optionId ? { ...option, code: value === "" ? undefined : value } : option
    ),
  };
};

/**
 * "Reset all": drops the question code and every answer code of one question. The editor's write
 * path fills each one with the next default (`q<n>`, 1..n), so a reset question is recoded, not blank.
 */
export const resetElementCodes = (
  element: TSurveyElement
): { code: undefined } & Partial<Record<TOptionListKey, TCodedOption[]>> => {
  const lists = Object.fromEntries(
    getOptionCodeLists(element).map(({ key, options }) => [
      key,
      options.map((option) => ({ ...option, code: undefined })),
    ])
  );
  return { code: undefined, ...lists };
};
