import type { TWorkflowDefinition } from "@formbricks/workflows";
import type { TWorkflowValidity } from "@/modules/workflows/state/editor";

/**
 * The single next step that unblocks an unready workflow, in build order (trigger before survey
 * before action before content before name). "not_executable" is the structural fallback for
 * graphs the zod schema rejects for reasons the guided steps don't cover (cycles, orphans, …).
 */
export type TWorkflowReadinessHint =
  | "add_trigger"
  | "complete_trigger"
  | "add_action"
  | "complete_action"
  | "name_missing"
  | "not_executable";

/**
 * An unfinished draft isn't "broken" — it just has a next step. This resolves validity into that
 * one step so the header can guide ("Add a trigger to get started") instead of alarming
 * ("Workflow has issues"). Returns null when the workflow is ready to run.
 */
export const getWorkflowReadinessHint = (
  definition: TWorkflowDefinition | null,
  validity: TWorkflowValidity
): TWorkflowReadinessHint | null => {
  if (validity.isReady) return null;

  if (!definition?.trigger) return "add_trigger";
  if (!validity.hasBoundTriggerSurvey) return "complete_trigger";

  const triggerId = definition.trigger.id;
  const hasTriggerEdge = definition.edges.some((edge) => edge.source === triggerId);
  if (definition.nodes.length === 0 || !hasTriggerEdge) return "add_action";

  const hasIncompleteEmail = definition.nodes.some(
    (node) =>
      node.type === "action" &&
      (!node.config.to.trim() || !node.config.subject.trim() || !node.config.body.trim())
  );
  if (hasIncompleteEmail) return "complete_action";

  if (!validity.isNameValid) return "name_missing";

  return "not_executable";
};
