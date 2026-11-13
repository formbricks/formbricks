import { findWorkflowRecallTokens } from "../variables/insert";
import { type TWorkflowVariableSource, parseWorkflowVariablePath } from "../variables/paths";
import { checkHttpRequest } from "./actions/http-request-check";
import type { TWorkflowSendEmailActionNode } from "./actions/send-email";
import { type TWorkflowDataRef } from "./common";
import { flattenWorkflowConditions } from "./conditions/base";
import type { TWorkflowIfElseNode } from "./conditions/if-else";
import { getBlankSendEmailContentFields } from "./content";
import type { TWorkflowStepNodeOfType, TWorkflowStepType } from "./steps";
import type { TWorkflowTriggerType } from "./triggers/enum";

/**
 * Which Variable sources a run of each trigger has. `steps` is always there; `response` only for
 * Response completed runs; `payload` joins with the Webhook trigger (ENG-7177 adds its entry).
 */
export const WORKFLOW_TRIGGER_VARIABLE_SOURCES: Record<
  TWorkflowTriggerType,
  readonly TWorkflowVariableSource[]
> = {
  "response.completed": ["response", "steps"],
  webhook: ["payload", "steps"],
};

export interface TWorkflowExecutableCheckContext {
  /** Ids of the steps that always run before this one: its ancestors on the one path from the trigger. */
  upstreamStepIds: ReadonlySet<string>;
  /** Variable sources the workflow's trigger provides. */
  availableSources: ReadonlySet<TWorkflowVariableSource>;
  /** Reports a problem; `path` is relative to the node (e.g. `["config", "subject"]`). */
  addIssue: (message: string, path?: (string | number)[]) => void;
}

export type TWorkflowExecutableNodeCheck<T extends TWorkflowStepType> = (
  node: TWorkflowStepNodeOfType<T>,
  context: TWorkflowExecutableCheckContext
) => void;

/**
 * Checks a Variable reference against what this step can see when it runs: a source the trigger
 * provides, and for `steps.<id>` a step that has already run on the way here.
 */
export const checkWorkflowVariableRef = (
  ref: TWorkflowDataRef,
  context: TWorkflowExecutableCheckContext,
  path: (string | number)[]
): void => {
  const parsed = parseWorkflowVariablePath(ref.path);
  if (!parsed.ok) return; // The persisted schema already reported it.

  if (!context.availableSources.has(parsed.source)) {
    context.addIssue(
      `Variable ${ref.path} uses ${parsed.source}, which this workflow's trigger does not provide`,
      path
    );
    return;
  }
  if (parsed.source === "steps" && !context.upstreamStepIds.has(parsed.segments[0])) {
    context.addIssue(
      `Variable ${ref.path} reads step ${parsed.segments[0]}, which never runs before this step`,
      path
    );
  }
};

const isDataRef = (value: unknown): value is TWorkflowDataRef =>
  typeof value === "object" && value !== null && !Array.isArray(value) && "path" in value;

const checkSendEmail = (
  node: TWorkflowSendEmailActionNode,
  context: TWorkflowExecutableCheckContext
): void => {
  // Draft configs may hold empty content (the persisted schema is permissive so authors can save
  // work in progress), but an executable send_email must actually have something to send.
  for (const field of getBlankSendEmailContentFields(node.config)) {
    context.addIssue(`send_email node ${node.id} is missing ${field}`, ["config", field]);
  }
  for (const token of findWorkflowRecallTokens(node.config.body)) {
    const parsed = parseWorkflowVariablePath(token.path);
    if (parsed.ok) {
      checkWorkflowVariableRef({ path: token.path }, context, ["config", "body"]);
    } else {
      context.addIssue(parsed.error, ["config", "body"]);
    }
  }
};

const checkIfElse = (node: TWorkflowIfElseNode, context: TWorkflowExecutableCheckContext): void => {
  for (const condition of flattenWorkflowConditions(node.config.condition)) {
    checkWorkflowVariableRef(condition.left, context, ["config", "condition"]);
    if (isDataRef(condition.right)) {
      checkWorkflowVariableRef(condition.right, context, ["config", "condition"]);
    }
  }
};

/**
 * What a step of each type must satisfy to run, beyond the graph rules every definition shares.
 * Keyed by step type, so adding an action type (ENG-7179 `http_request`) fails to compile until it
 * adds its check here, written in its own file.
 */
export const WORKFLOW_EXECUTABLE_NODE_CHECKS: { [T in TWorkflowStepType]: TWorkflowExecutableNodeCheck<T> } =
  {
    send_email: checkSendEmail,
    http_request: checkHttpRequest,
    if_else: checkIfElse,
  };
