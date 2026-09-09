/**
 * Shape summary of a workflow definition for product analytics (ENG-2851).
 *
 * The point of this module is that it never names a trigger or action type: it reads the concrete
 * type off each node, so a new trigger kind or a new step kind reports itself in analytics the day
 * someone uses it, with no instrumentation change. Keep it that way; a hardcoded enum here would
 * silently drop every type added after it.
 *
 * The input is deliberately structural rather than `TWorkflowDefinition`: the daily usage snapshot
 * reads the raw `definition` JSON column straight from Prisma, and a malformed or pre-migration
 * document must summarize to zeros, not throw inside a job.
 */
import { isLiteralEmailRecipient } from "../recipients";

/** The subset of a node the summary reads. Matches both persisted JSON and the parsed Zod types. */
interface WorkflowNodeLike {
  type?: unknown;
  triggerType?: unknown;
  actionType?: unknown;
  config?: unknown;
}

/** Structural view of a definition; every field is `unknown` so raw JSON is accepted and guarded. */
export interface WorkflowDefinitionLike {
  trigger?: unknown;
  nodes?: unknown;
}

export interface WorkflowDefinitionSummary {
  /** The trigger's concrete type (`response.completed`), or `null` while the draft has none. */
  triggerType: string | null;
  /**
   * Distinct, sorted concrete types of every non-trigger node. An action node contributes its
   * `actionType` (`send_email`); any other node kind contributes its `type` (`if_else`), so a
   * node kind with no sub-type still shows up under its own name.
   */
  actionTypes: string[];
  /** Number of non-trigger nodes, duplicates included. */
  actionCount: number;
  /** Trigger plus non-trigger nodes. */
  nodeCount: number;
}

const isNodeLike = (value: unknown): value is WorkflowNodeLike => typeof value === "object" && value !== null;

const readString = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

/**
 * Concrete analytics type of a single node: `triggerType` for triggers, `actionType` for actions,
 * otherwise the node `type` itself. Returns `null` for anything that is not a typed node so callers
 * can skip it rather than count an `"unknown"` bucket.
 */
export const getWorkflowNodeConcreteType = (node: unknown): string | null => {
  if (!isNodeLike(node)) return null;
  return readString(node.triggerType) ?? readString(node.actionType) ?? readString(node.type);
};

export const summarizeWorkflowDefinition = (
  definition: WorkflowDefinitionLike | null | undefined
): WorkflowDefinitionSummary => {
  const triggerType = getWorkflowNodeConcreteType(definition?.trigger);
  const nodes = Array.isArray(definition?.nodes) ? definition.nodes : [];

  const concreteTypes = nodes
    .map(getWorkflowNodeConcreteType)
    .filter((type): type is string => type !== null);

  return {
    triggerType,
    actionTypes: [...new Set(concreteTypes)].sort((a, b) => a.localeCompare(b)),
    actionCount: concreteTypes.length,
    nodeCount: concreteTypes.length + (triggerType ? 1 : 0),
  };
};

/**
 * Stable string form of `actionTypes` for "combination" breakdowns (`send_email` versus
 * `if_else,send_email`). Sorted input keeps two workflows with the same steps in a different order
 * in the same bucket.
 */
export const joinWorkflowActionTypes = (actionTypes: readonly string[]): string => actionTypes.join(",");

export interface WorkflowDefinitionOptions {
  /** `response.completed` trigger: fires on `all` endings or only `specific` ending cards. */
  endingScope: "all" | "specific" | null;
  /**
   * `send_email` actions: whether recipients are author-chosen `literal` addresses, survey `element`
   * ids resolved per response, or `mixed` across several actions.
   */
  emailRecipientKind: "literal" | "element" | "mixed" | null;
  /** `send_email` actions: `true` when any action has the option on. */
  attachResponseData: boolean | null;
  includeVariables: boolean | null;
  includeHiddenFields: boolean | null;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const anyFlag = (configs: Record<string, unknown>[], key: string): boolean | null =>
  configs.length === 0 ? null : configs.some((config) => config[key] === true);

/**
 * PII-free configuration facts for the node types that exist today. Unlike
 * `summarizeWorkflowDefinition` this necessarily names types; extend it when a new node type ships
 * options worth tracking. Only booleans and small enums leave here: never a recipient, subject or
 * body, so no analytics adapter can forward them by accident. An unknown or malformed node yields
 * `null`s, never a throw.
 */
export const summarizeWorkflowDefinitionOptions = (
  definition: WorkflowDefinitionLike | null | undefined
): WorkflowDefinitionOptions => {
  const trigger = definition?.trigger;
  let endingScope: WorkflowDefinitionOptions["endingScope"] = null;
  if (isNodeLike(trigger) && trigger.triggerType === "response.completed" && isRecord(trigger.config)) {
    const endingCardIds = trigger.config.endingCardIds;
    endingScope = Array.isArray(endingCardIds) && endingCardIds.length > 0 ? "specific" : "all";
  }

  const nodes = Array.isArray(definition?.nodes) ? definition.nodes : [];
  const emailConfigs = nodes
    .filter((node): node is WorkflowNodeLike => isNodeLike(node) && node.actionType === "send_email")
    .map((node) => node.config)
    .filter(isRecord);

  const recipientKinds = new Set(
    emailConfigs
      .map((config) => config.to)
      .filter((to): to is string => typeof to === "string" && to.length > 0)
      .map((to) => (isLiteralEmailRecipient(to) ? "literal" : "element"))
  );
  let emailRecipientKind: WorkflowDefinitionOptions["emailRecipientKind"] = null;
  if (recipientKinds.size === 1) emailRecipientKind = [...recipientKinds][0];
  else if (recipientKinds.size > 1) emailRecipientKind = "mixed";

  return {
    endingScope,
    emailRecipientKind,
    attachResponseData: anyFlag(emailConfigs, "attachResponseData"),
    includeVariables: anyFlag(emailConfigs, "includeVariables"),
    includeHiddenFields: anyFlag(emailConfigs, "includeHiddenFields"),
  };
};
