import type { TSurvey } from "@formbricks/types/surveys/types";

type TIssuePath = readonly PropertyKey[];

/** What one validation issue flags: the ids whose cards turn red, and the card to scroll to. */
type TIssueTargets = { ids: string[]; scrollId: string | null };

const NO_TARGETS: TIssueTargets = { ids: [], scrollId: null };

const targetsOf = (id: string | undefined): TIssueTargets => ({ ids: id ? [id] : [], scrollId: id ?? null });

const getBlockIssueTargets = (survey: TSurvey, path: TIssuePath): TIssueTargets => {
  const block = survey.blocks?.[path[1] as number];

  if (path[2] === "elements" && typeof path[3] === "number") {
    return targetsOf(block?.elements[path[3]]?.id);
  }
  if (path[2] === "name") {
    // Empty block name: flag the block itself so its card turns red. Block ids never collide with
    // element or logic-rule ids, so this is unambiguous in invalidElements.
    return targetsOf(block?.id);
  }
  if (path[2] === "logic" && typeof path[3] === "number") {
    // Conditional logic error: flag the offending rule so its row on the Flow tab (ENG-6929)
    // surfaces it. Uses the logic rule id (a CUID, distinct from element ids), which is also the
    // row's DOM id.
    return targetsOf(block?.logic?.[path[3]]?.id);
  }
  if (path[2] === "logic") {
    // Block-scope logic error (e.g. a cyclic jump) with no specific rule index: flag every rule in
    // the block so each row on the Flow tab shows it.
    return {
      ids: (block?.logic ?? []).map((logicItem) => logicItem.id),
      scrollId: block?.logic?.[0]?.id ?? null,
    };
  }
  return NO_TARGETS;
};

const getIssueTargets = (survey: TSurvey, path: TIssuePath): TIssueTargets => {
  if (path[0] === "blocks") {
    return getBlockIssueTargets(survey, path);
  }
  if (path[0] === "startLogic" && typeof path[1] === "number") {
    // A rule before the first question (ENG-6932): flag its row on the Flow tab.
    return targetsOf(survey.startLogic?.[path[1]]?.id);
  }
  if (path[0] === "welcomeCard") {
    return targetsOf("start");
  }
  if (path[0] === "endings") {
    const endingIdx = typeof path[1] === "number" ? path[1] : -1;
    return targetsOf(survey.endings[endingIdx]?.id);
  }
  return NO_TARGETS;
};

/**
 * The cards a failed survey validation flags, in issue order and without repeats, and the first one
 * to scroll into view: for logic errors the rule's row, for element errors the element card.
 */
export const getInvalidSurveyTargets = (
  survey: TSurvey,
  issues: ReadonlyArray<{ path: TIssuePath }>
): { invalidIds: string[]; firstInvalidScrollId: string | null } => {
  const invalidIds: string[] = [];
  let firstInvalidScrollId: string | null = null;

  for (const issue of issues) {
    const { ids, scrollId } = getIssueTargets(survey, issue.path);
    for (const id of ids) {
      if (!invalidIds.includes(id)) {
        invalidIds.push(id);
      }
    }
    firstInvalidScrollId ??= scrollId;
  }

  return { invalidIds, firstInvalidScrollId };
};

/** Whether the issue is about a rule or fallback, which live on the Flow tab (ENG-6929). */
export const isFlowTabIssue = (path: TIssuePath): boolean =>
  path[0] === "startLogic" || (path[0] === "blocks" && (path[2] === "logic" || path[2] === "logicFallback"));
