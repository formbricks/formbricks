import { WORKFLOW_TRIGGERS } from "@formbricks/workflows";
import type { TWorkflowExecutableDefinition } from "@formbricks/workflows";

/** An enabled workflow with its current published version's executable definition. */
export interface WorkflowMatchCandidate {
  workflowId: string;
  publishedVersionId: string;
  definition: TWorkflowExecutableDefinition;
}

export interface WorkflowMatch {
  workflowId: string;
  publishedVersionId: string;
}

export interface ResponseMatchInput {
  surveyId: string;
  endingId: string;
}

/**
 * Pure matcher: from the candidate enabled workflows (each carrying its current published version's
 * definition), return those whose `response.completed` trigger fires for this completed response —
 * the trigger targets the response's survey and its ending filter passes (empty `endingCardIds` means
 * "any ending", otherwise the reached `endingId` must be listed). No I/O, so it's exhaustively
 * table-testable. Matching reads the published snapshot, never the mutable draft.
 */
export const matchWorkflowsForResponse = (
  candidates: WorkflowMatchCandidate[],
  { surveyId, endingId }: ResponseMatchInput
): WorkflowMatch[] =>
  candidates
    .filter(({ definition }) => {
      const { trigger } = definition;
      if (trigger.triggerType !== WORKFLOW_TRIGGERS.RESPONSE_COMPLETED) return false;

      const { surveyId: triggerSurveyId, endingCardIds } = trigger.config;
      if (triggerSurveyId !== surveyId) return false;

      return endingCardIds.length === 0 || endingCardIds.includes(endingId);
    })
    .map(({ workflowId, publishedVersionId }) => ({ workflowId, publishedVersionId }));
