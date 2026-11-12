import { TFunction } from "i18next";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { getLocalizedValue } from "@/lib/i18n/utils";
import { TEditorIssue, sortIssuesForSummary } from "./validation-issues";

/**
 * The same thing wrong in several places of one question ("Enter an option", five times) reads as one entry.
 * Entries keep the summary's order: by tab, then survey order.
 */
export const mergeRepeatedIssues = (issues: TEditorIssue[]): { issue: TEditorIssue; count: number }[] => {
  const repeats = new Map<string, { issue: TEditorIssue; count: number }>();
  for (const issue of sortIssuesForSummary(issues)) {
    const repeatKey = [issue.tab, issue.targetId, issue.location, issue.message].join("|");
    const seen = repeats.get(repeatKey);
    if (seen) seen.count += 1;
    else repeats.set(repeatKey, { issue, count: 1 });
  }
  return [...repeats.values()];
};

export const getIssueSummaryLabel = (issue: TEditorIssue, count: number, t: TFunction): string =>
  count > 1
    ? t("workspace.surveys.edit.issue_repeat_count", { message: issue.message, count })
    : issue.message;

/** The question's own text, to sit beside "Block 2, Question 1" so the author recognises it without counting. */
export const getIssueLocationDetail = (survey: TSurvey, issue: TEditorIssue): string | null => {
  if (issue.tab !== "elements" || !issue.targetId) return null;
  const element = survey.blocks
    .flatMap((block) => block.elements)
    .find((candidate) => candidate.id === issue.targetId);
  if (!element) return null;
  const text = getTextContent(getLocalizedValue(element.headline, "default")).replaceAll(/\s+/g, " ").trim();
  return text || null;
};

type TBlock = TSurvey["blocks"][number];

/** Whether the target is the block itself, one of its rules, or one of its questions. */
export const blockOwnsTarget = (block: TBlock, targetId: string): boolean =>
  block.id === targetId ||
  !!block.logic?.some((rule) => rule.id === targetId) ||
  block.elements.some((element) => element.id === targetId);

export const findIssueOwnerBlock = (survey: TSurvey, targetId: string): TBlock | undefined =>
  survey.blocks.find((block) => blockOwnsTarget(block, targetId));

/** The target, when it is one of the survey's rules (a block's, or one before the first question). */
export const findRuleId = (survey: TSurvey, targetId: string): string | null => {
  const isRule =
    survey.blocks.some((block) => block.logic?.some((rule) => rule.id === targetId)) ||
    !!survey.startLogic?.some((rule) => rule.id === targetId);
  return isRule ? targetId : null;
};

/**
 * The question to open for an issue on the Questions tab: a block's own issue (its name) opens its first
 * question; a card or a question opens itself.
 */
export const getElementToOpen = (survey: TSurvey, targetId: string): string | null => {
  const block = survey.blocks.find((candidate) => candidate.id === targetId);
  return block ? (block.elements[0]?.id ?? null) : targetId;
};
