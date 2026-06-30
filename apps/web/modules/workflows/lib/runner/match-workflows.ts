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

/** Loose view of a trigger node: the published definition is persisted DB JSON, branded as
 * `TWorkflowExecutableDefinition` but never parsed on read, so it must be treated as untrusted. */
interface LooseTriggerNode {
  triggerType?: string;
  config?: { surveyId?: unknown; endingCardIds?: unknown };
}

/**
 * Reads the `response.completed` trigger config from a published definition. Because the definition is
 * unvalidated DB JSON, this is **total**: it returns `null` (never throws) when the snapshot is
 * malformed or isn't a `response.completed` trigger, so a single bad version skips its own workflow
 * instead of throwing and aborting matching for every workflow on the response.
 */
export const readResponseCompletedTriggerConfig = (
  definition: TWorkflowExecutableDefinition
): { surveyId: string; endingCardIds: string[] } | null => {
  const trigger = (definition as { trigger?: LooseTriggerNode }).trigger;
  if (trigger?.triggerType !== WORKFLOW_TRIGGERS.RESPONSE_COMPLETED) return null;

  const surveyId = trigger.config?.surveyId;
  const endingCardIds = trigger.config?.endingCardIds;
  if (typeof surveyId !== "string" || !Array.isArray(endingCardIds)) return null;
  if (!endingCardIds.every((id): id is string => typeof id === "string")) return null;

  return { surveyId, endingCardIds };
};

/**
 * Pure matcher: from the candidate enabled workflows (each carrying its current published version's
 * definition), return those whose `response.completed` trigger fires for this completed response —
 * the trigger targets the response's survey and its ending filter passes (empty `endingCardIds` means
 * "any ending", otherwise the reached `endingId` must be listed). No I/O, so it's exhaustively
 * table-testable. Reads the published snapshot (never the mutable draft) and is total over malformed
 * definitions (a bad one simply doesn't match).
 */
export const matchWorkflowsForResponse = (
  candidates: WorkflowMatchCandidate[],
  { surveyId, endingId }: ResponseMatchInput
): WorkflowMatch[] =>
  candidates
    .filter(({ definition }) => {
      const config = readResponseCompletedTriggerConfig(definition);
      if (!config) return false;
      if (config.surveyId !== surveyId) return false;
      return config.endingCardIds.length === 0 || config.endingCardIds.includes(endingId);
    })
    .map(({ workflowId, publishedVersionId }) => ({ workflowId, publishedVersionId }));
