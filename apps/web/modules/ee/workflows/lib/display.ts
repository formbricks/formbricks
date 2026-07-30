import type { TFunction } from "i18next";
import {
  type TWorkflowDefinition,
  type TWorkflowRunLogStatus,
  type TWorkflowRunStatus,
  type TWorkflowStatus,
  type TWorkflowTriggerType,
  getBlankSendEmailContentFields,
} from "@formbricks/workflows";
import { getNodeRegistryEntry } from "@/modules/ee/workflows/lib/node-registry";
import {
  type TWorkflowNodeFieldFocusRequest,
  type TWorkflowValidationProblem,
  workflowProblemFields,
} from "@/modules/ee/workflows/state/editor";

type TBadgeType = "warning" | "success" | "error" | "gray";

interface TStatusBadge {
  label: string;
  type: TBadgeType;
}

export const getWorkflowStatusBadge = (status: TWorkflowStatus, t: TFunction): TStatusBadge => {
  switch (status) {
    case "enabled":
      return { label: t("common.enabled"), type: "success" };
    case "disabled":
      return { label: t("common.disabled"), type: "gray" };
    case "archived":
      return { label: t("common.archived"), type: "gray" };
    case "draft":
    default:
      return { label: t("common.draft"), type: "gray" };
  }
};

export const getWorkflowRunStatusBadge = (status: TWorkflowRunStatus, t: TFunction): TStatusBadge => {
  switch (status) {
    case "completed":
      return { label: t("common.completed"), type: "success" };
    case "failed":
      return { label: t("common.failed"), type: "error" };
    case "running":
      return { label: t("common.running"), type: "warning" };
    case "canceled":
      return { label: t("common.canceled"), type: "gray" };
    case "queued":
    default:
      return { label: t("common.queued"), type: "gray" };
  }
};

export const getWorkflowRunLogStatusBadge = (status: TWorkflowRunLogStatus, t: TFunction): TStatusBadge => {
  switch (status) {
    case "succeeded":
      return { label: t("common.succeeded"), type: "success" };
    case "failed":
      return { label: t("common.failed"), type: "error" };
    case "running":
      return { label: t("common.running"), type: "warning" };
    case "skipped":
      return { label: t("common.skipped"), type: "gray" };
    case "pending":
      return { label: t("common.pending"), type: "gray" };
  }

  // Exhaustive: a new TWorkflowRunLogStatus from the contract fails to compile here
  // instead of being silently mislabeled as "pending".
  const exhaustiveCheck: never = status;
  return exhaustiveCheck;
};

export const getWorkflowTriggerTypeLabel = (triggerType: TWorkflowTriggerType, t: TFunction): string => {
  const labels: Record<TWorkflowTriggerType, string> = {
    "response.completed": t("common.response_completed"),
  };

  return labels[triggerType];
};

const NODE_FIELD_PATTERN = /^nodes\.(\d+)(?:\.|$)/;

/**
 * Human-readable location for a validation problem, shown under its message in the problems
 * dialog: the display title of the step or trigger the problem's `field` points into (the same
 * title the canvas card shows — a user-authored label or the localized node-type name). Null for
 * whole-flow problems (missing/unconnected trigger, broken flow shape) and any field that does
 * not resolve to a concrete node — raw machine paths are never shown.
 */
export const getWorkflowValidationProblemLocation = (
  problem: TWorkflowValidationProblem,
  definition: TWorkflowDefinition | null,
  t: TFunction
): string | null => {
  if (!definition) return null;

  const nodeMatch = NODE_FIELD_PATTERN.exec(problem.field);
  if (nodeMatch) {
    const node = definition.nodes[Number(nodeMatch[1])];
    if (!node) return null;
    return getNodeRegistryEntry(node).title(node, t);
  }

  // Only fields inside the trigger's config locate an existing node; the bare "trigger" field
  // (= trigger_missing) has nothing on the canvas to point at.
  if (problem.field.startsWith("trigger.") && definition.trigger) {
    return getNodeRegistryEntry(definition.trigger).title(definition.trigger, t);
  }

  return null;
};

// Which trigger config path maps to which control in the trigger form. Keyed off the shared
// builders, so a renamed path is a compile error here rather than a jump that silently stops
// resolving at runtime.
const TRIGGER_CONFIG_FIELD_TARGETS: Record<string, string> = {
  [workflowProblemFields.triggerSurveyId]: "surveyId",
  [workflowProblemFields.triggerEndingCardIds]: "endingCardIds",
};

/**
 * The config field a validation problem should send the user to, or null when the problem has no
 * single field to fix (a missing trigger, a broken flow shape, an unnamed workflow — those are
 * fixed on the canvas or in the page title, not in a config form).
 *
 * `step_incomplete` deliberately carries a step-level field (`nodes.N.config`) so the problem count
 * matches the one unfinished step the user perceives; the specific field is resolved here instead,
 * as the first still-blank required one in form order.
 */
export const getWorkflowValidationProblemFocusTarget = (
  problem: TWorkflowValidationProblem,
  definition: TWorkflowDefinition | null
): TWorkflowNodeFieldFocusRequest | null => {
  if (!definition) return null;

  // Only the exact step-level path `step_incomplete` reports at resolves to a content field. A
  // problem elsewhere on an action node (a shape issue at `nodes.N.label`, an unsupported
  // `nodes.N.type`) must not land the user on a field its message never mentioned.
  const nodeIndex = workflowProblemFields.parseNodeConfigIndex(problem.field);
  if (nodeIndex !== null) {
    const node = definition.nodes[nodeIndex];
    // Covers an out-of-range index too: `undefined?.type` is undefined, which is not "action".
    if (node?.type !== "action") return null;
    const [firstBlankField] = getBlankSendEmailContentFields(node.config);
    return firstBlankField ? { nodeId: node.id, field: firstBlankField } : null;
  }

  // A stale ending is a problem with the endings list, not with the survey itself — sending it to
  // the survey picker would imply the wrong fix.
  const triggerField = TRIGGER_CONFIG_FIELD_TARGETS[problem.field];
  if (triggerField && definition.trigger) {
    return { nodeId: definition.trigger.id, field: triggerField };
  }

  return null;
};
