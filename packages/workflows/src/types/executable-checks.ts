import { findWorkflowRecallTokens } from "../variables/insert";
import { type TWorkflowVariableSource, parseWorkflowVariablePath } from "../variables/paths";
import {
  type TWorkflowSendEmailActionNode,
  WORKFLOW_SURVEY_LINK_TOKEN,
  isVariableEmailRecipient,
} from "./actions/send-email";
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

/** Checks every Variable-path recall token in a text field against what the step can see. */
const checkTextVariables = (
  text: string,
  context: TWorkflowExecutableCheckContext,
  path: (string | number)[]
): void => {
  for (const token of findWorkflowRecallTokens(text)) {
    const parsed = parseWorkflowVariablePath(token.path);
    if (parsed.ok) {
      checkWorkflowVariableRef({ path: token.path }, context, path);
    } else {
      context.addIssue(parsed.error, path);
    }
  }
};

const RECALL_TOKEN_START = "#recall:";
const countRecallTokens = (text: string): number => text.split(RECALL_TOKEN_START).length - 1;

/**
 * The fixed-body rule (ENG-7169): when a Variable picks the recipient, the caller picks who gets the
 * email, so nothing the caller sends may decide what it says. Subject and body take no recall token
 * at all (a Variable or a survey answer) and no response data is attached. Only the survey link's
 * Embedded Data may carry Variables. Without it, a leaked Webhook Secret URL would let anyone send
 * any text, links included, from the customer's sender domain.
 */
const checkFixedContent = (
  node: TWorkflowSendEmailActionNode,
  context: TWorkflowExecutableCheckContext
): void => {
  const { subject, body, attachResponseData } = node.config;
  const reason = "the recipient comes from a Variable, so the email must be fixed";
  if (body.includes(RECALL_TOKEN_START)) {
    context.addIssue(`send_email node ${node.id} body may not insert Variables or answers: ${reason}`, [
      "config",
      "body",
    ]);
  }
  if (subject.includes(RECALL_TOKEN_START)) {
    context.addIssue(`send_email node ${node.id} subject may not insert Variables or answers: ${reason}`, [
      "config",
      "subject",
    ]);
  }
  if (attachResponseData) {
    context.addIssue(`send_email node ${node.id} may not set attachResponseData: ${reason}`, [
      "config",
      "attachResponseData",
    ]);
  }
};

const checkSurveyLink = (
  node: TWorkflowSendEmailActionNode,
  context: TWorkflowExecutableCheckContext
): void => {
  const { surveyLink, body } = node.config;
  const placesLink = body.includes(WORKFLOW_SURVEY_LINK_TOKEN);
  if (!surveyLink) {
    if (placesLink) {
      context.addIssue(
        `send_email node ${node.id} places a survey link but has no surveyLink to build it from`,
        ["config", "surveyLink"]
      );
    }
    return;
  }
  if (!placesLink) {
    context.addIssue(
      `send_email node ${node.id} has a survey link but its body never places it: insert ${WORKFLOW_SURVEY_LINK_TOKEN}`,
      ["config", "body"]
    );
  }
  for (const [index, { value }] of surveyLink.embeddedData.entries()) {
    const path = ["config", "surveyLink", "embeddedData", index, "value"];
    checkTextVariables(value, context, path);
    // Survey recall (a bare question id) is not expanded on a link, so it would go out as written.
    if (countRecallTokens(value) > findWorkflowRecallTokens(value).length) {
      context.addIssue("Embedded Data values may only insert Variables (payload., steps., response.)", path);
    }
  }
};

const checkSendEmail = (
  node: TWorkflowSendEmailActionNode,
  context: TWorkflowExecutableCheckContext
): void => {
  // Draft configs may hold empty content (the persisted schema is permissive so authors can save
  // work in progress), but an executable send_email must actually have something to send.
  for (const field of getBlankSendEmailContentFields(node.config)) {
    context.addIssue(`send_email node ${node.id} is missing ${field}`, ["config", field]);
  }
  checkTextVariables(node.config.body, context, ["config", "body"]);

  const { to } = node.config;
  if (isVariableEmailRecipient(to)) {
    checkWorkflowVariableRef({ path: to.ref }, context, ["config", "to"]);
    checkFixedContent(node, context);
  }
  checkSurveyLink(node, context);
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
    if_else: checkIfElse,
  };
