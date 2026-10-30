import { TFunction } from "i18next";
import { TCodeIssue } from "@formbricks/types/surveys/codes";
import {
  TPublishedLockViolation,
  TPublishedLockViolationKind,
} from "@formbricks/types/surveys/published-lock";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { type TOptionListKey, getElementCodeIssues, optionIssueKey } from "./element-codes";

/**
 * The text under a code field that fails the check. One message per way a code can be wrong, chosen
 * from the validator's issue (`kind` and `reason`), so the field says why and the publish check agrees.
 * Literal `t()` calls, so the translation scanner sees every key.
 *
 * `clashLabel` names what a duplicate clashes with (see `getCodeClashLabel`).
 */
export const describeCodeIssue = (
  issue: TCodeIssue,
  kind: "question" | "answer",
  t: TFunction,
  clashLabel?: string
): string => {
  const code = issue.value;
  switch (issue.kind) {
    case "duplicate_question_code":
    case "duplicate_answer_code":
    // The export column this code would make is one the named question already has.
    case "clashes_export_column":
      return t("workspace.surveys.edit.code_error_used_by", { code, name: clashLabel ?? issue.clashesWith });
    case "clashes_embedded_data":
      return t("workspace.surveys.edit.code_error_used_by_embedded_data", { code, name: issue.clashesWith });
    case "clashes_question_id":
      return t("workspace.surveys.edit.code_error_used_as_question_id", { code });
    case "invalid_format":
      switch (issue.reason) {
        case "empty":
          return t("workspace.surveys.edit.code_error_empty");
        case "must_start_with_lowercase_letter":
          return t("workspace.surveys.edit.code_error_start_lowercase");
        case "must_start_with_letter_or_digit":
          return t("workspace.surveys.edit.code_error_leading_underscore");
        case "double_underscore":
          return t("workspace.surveys.edit.code_error_double_underscore");
        case "trailing_underscore":
          return t("workspace.surveys.edit.code_error_trailing_underscore");
        case "too_long":
          return t("workspace.surveys.edit.code_error_too_long", { max: kind === "question" ? 30 : 20 });
        case "spss_reserved_word":
          return t("workspace.surveys.edit.code_error_spss_reserved", { code });
        case "export_column_name":
          return t("workspace.surveys.edit.code_error_export_column_taken", { code });
        default:
          return t("workspace.surveys.edit.code_error_characters");
      }
  }
};

/**
 * What a duplicate code clashes with, as a reader would name it: a question by its text and block
 * ("How are you? in Block 1"), an answer by its label. `undefined` for the other kinds.
 */
export const getCodeClashLabel = (survey: TSurvey, issue: TCodeIssue, t: TFunction): string | undefined => {
  if (!issue.clashesWith) return undefined;
  const [, blockIdx, , elementIdx, listKey] = issue.path;

  if (issue.kind === "duplicate_question_code" || issue.kind === "clashes_export_column") {
    for (const block of survey.blocks) {
      const element = block.elements.find((candidate) => candidate.id === issue.clashesWith);
      if (!element) continue;
      const headline = getTextContent(getLocalizedValue(element.headline, "default"));
      return t("workspace.surveys.edit.code_clash_question_in_block", {
        question: headline || element.id,
        block: block.name,
      });
    }
    return undefined;
  }

  if (issue.kind === "duplicate_answer_code" && typeof listKey === "string") {
    const element = survey.blocks[blockIdx as number]?.elements[elementIdx as number] as
      | Record<string, unknown>
      | undefined;
    const options = (element?.[listKey] ?? []) as { id: string; label?: Record<string, string> }[];
    const label = options.find((option) => option.id === issue.clashesWith)?.label;
    return label ? getLocalizedValue(label, "default") || undefined : undefined;
  }
  return undefined;
};

/**
 * The message of the code issue a schema error points at, in the editor's own words: `path` is the Zod issue's
 * path (`blocks.<b>.elements.<e>.code`, or `...<list>.<i>.code` for an answer code). `undefined` when the path
 * is not a code or no issue is found there.
 */
export const describeCodeIssueAtPath = (
  survey: TSurvey,
  path: readonly (string | number)[],
  t: TFunction
): string | undefined => {
  if (path[0] !== "blocks" || path[2] !== "elements" || path.at(-1) !== "code") return undefined;
  const element = survey.blocks[path[1] as number]?.elements[path[3] as number];
  const entry = element ? getElementCodeIssues(survey).get(element.id) : undefined;
  if (!element || !entry) return undefined;

  const isAnswerCode = path.length === 7;
  const listKey = path[4] as TOptionListKey;
  const option = isAnswerCode
    ? (element as unknown as Record<string, { id: string }[] | undefined>)[listKey]?.[path[5] as number]
    : undefined;
  const issue = isAnswerCode
    ? option && entry.options.get(optionIssueKey(listKey, option.id))
    : entry.question;
  if (!issue) return undefined;
  return describeCodeIssue(
    issue,
    isAnswerCode ? "answer" : "question",
    t,
    getCodeClashLabel(survey, issue, t)
  );
};

/**
 * The published lock's refusal, in the editor's words: what the lock keeps, grouped by kind and naming the
 * questions it was about (headline, else code, else id), instead of the server's English sentence with its
 * internal IDs. Literal `t()` calls, so the translation scanner sees every key.
 */
export const describeLockRefusal = (
  violations: readonly TPublishedLockViolation[],
  survey: TSurvey,
  t: TFunction
): string => {
  const explanation: Record<TPublishedLockViolationKind, string> = {
    question_code_changed: t("workspace.surveys.edit.lock_explanation_code"),
    answer_code_changed: t("workspace.surveys.edit.lock_explanation_code"),
    question_type_changed: t("workspace.surveys.edit.lock_explanation_type"),
    option_text_changed: t("workspace.surveys.edit.lock_explanation_option_text"),
    option_deleted: t("workspace.surveys.edit.lock_explanation_option_delete"),
  };
  const questionName = (elementId: string): string => {
    for (const block of survey.blocks) {
      const element = block.elements.find((candidate) => candidate.id === elementId);
      if (!element) continue;
      const code = "code" in element ? element.code : undefined;
      return getTextContent(getLocalizedValue(element.headline, "default")) || code || element.id;
    }
    return elementId;
  };

  const namesByExplanation = new Map<string, Set<string>>();
  for (const violation of violations) {
    const text = explanation[violation.kind];
    const names = namesByExplanation.get(text) ?? new Set<string>();
    names.add(questionName(violation.elementId));
    namesByExplanation.set(text, names);
  }
  return [...namesByExplanation].map(([text, names]) => `${[...names].join(", ")}: ${text}`).join(" ");
};
