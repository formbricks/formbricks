import type { TFunction } from "i18next";
import type { ComponentType } from "react";
import {
  type TWorkflowNode,
  WORKFLOW_ACTIONS,
  WORKFLOW_TRIGGERS,
  isResponseCompletedTrigger,
  isVariableEmailRecipient,
} from "@formbricks/workflows";
import { WorkflowEmailActionForm } from "@/modules/ee/workflows/components/inspector/workflow-email-action-form";
import { WorkflowHttpRequestForm } from "@/modules/ee/workflows/components/inspector/workflow-http-request-form";
import {
  WorkflowFilterForm,
  WorkflowIfElseForm,
} from "@/modules/ee/workflows/components/inspector/workflow-if-else-form";
import { WorkflowSwitchForm } from "@/modules/ee/workflows/components/inspector/workflow-switch-form";
import { WorkflowTriggerForm } from "@/modules/ee/workflows/components/inspector/workflow-trigger-form";
import { WorkflowWebhookTriggerForm } from "@/modules/ee/workflows/components/inspector/workflow-webhook-trigger-form";
import { describeHttpRequestTarget } from "@/modules/ee/workflows/lib/http-request-panel";
import { describeIfElseCondition } from "@/modules/ee/workflows/lib/if-else-summary";
import { type TVariableLabels, getVariableDisplayName } from "@/modules/ee/workflows/lib/variable-name";
import type { TWorkflowNodeCategory, TWorkflowNodeIcon } from "@/modules/ee/workflows/state/editor";

export type TWorkflowNodeRegistryKind =
  | `trigger:${(typeof WORKFLOW_TRIGGERS)[keyof typeof WORKFLOW_TRIGGERS]}`
  | `action:${(typeof WORKFLOW_ACTIONS)[keyof typeof WORKFLOW_ACTIONS]}`
  | "if_else"
  | "filter"
  | "switch";

export interface TWorkflowNodeFormProps<TNode extends TWorkflowNode> {
  node: TNode;
  isEditable: boolean;
  onChange: (next: TNode) => void;
}

export interface TWorkflowNodeRegistryEntry {
  kind: TWorkflowNodeRegistryKind;
  category: TWorkflowNodeCategory;
  icon: TWorkflowNodeIcon;
  title: (node: TWorkflowNode, t: TFunction) => string;
  /** The step's docs page, linked from the panel header. */
  docsUrl?: string;
  /** `labels` names Variables by what users know them as, e.g. a question's headline. */
  summary: (node: TWorkflowNode, t: TFunction, labels?: TVariableLabels) => string;
  // Stored erased to `TWorkflowNode`; the inspector narrows by kind before rendering.
  ConfigForm: ComponentType<TWorkflowNodeFormProps<TWorkflowNode>> | null;
}

const eraseForm = <TNode extends TWorkflowNode>(
  Form: ComponentType<TWorkflowNodeFormProps<TNode>>
): ComponentType<TWorkflowNodeFormProps<TWorkflowNode>> =>
  Form as unknown as ComponentType<TWorkflowNodeFormProps<TWorkflowNode>>;

const responseCompletedTriggerEntry: TWorkflowNodeRegistryEntry = {
  kind: `trigger:${WORKFLOW_TRIGGERS.RESPONSE_COMPLETED}`,
  category: "trigger",
  // The Surveys icon of the main navigation: this trigger is a survey response.
  icon: "survey",
  title: (_node, t) => t("workspace.workflows.response_completed"),
  summary: (node, t) => {
    if (node.type !== "trigger" || !isResponseCompletedTrigger(node)) return "";
    return node.config.endingCardIds.length > 0
      ? t("workspace.workflows.trigger_summary_ending_cards", {
          count: node.config.endingCardIds.length,
        })
      : t("workspace.workflows.trigger_summary_all_endings");
  },
  ConfigForm: eraseForm(WorkflowTriggerForm),
};

const sendEmailActionEntry: TWorkflowNodeRegistryEntry = {
  kind: `action:${WORKFLOW_ACTIONS.SEND_EMAIL}`,
  category: "action",
  icon: "email",
  title: (node, t) => node.label ?? t("workspace.workflows.send_email"),
  summary: (node, t, labels) => {
    if (node.type !== "action" || node.actionType !== WORKFLOW_ACTIONS.SEND_EMAIL) return "";
    const { to, surveyLink } = node.config;
    // A Variable recipient reads as the picker shows it: "@customer.email".
    const recipient = isVariableEmailRecipient(to) ? `@${getVariableDisplayName(to.ref, labels)}` : to;
    if (!recipient) return t("workspace.workflows.send_email_unconfigured");
    return surveyLink
      ? t("workspace.workflows.send_email_summary_with_link", { to: recipient })
      : t("workspace.workflows.send_email_summary", { to: recipient });
  },
  ConfigForm: eraseForm(WorkflowEmailActionForm),
};

const ifElseEntry: TWorkflowNodeRegistryEntry = {
  kind: "if_else",
  category: "flow",
  icon: "ifElse",
  title: (node, t) => node.label ?? t("workspace.workflows.if_else"),
  summary: (node, t, labels) =>
    (node.type === "if_else" ? describeIfElseCondition(node.config.condition, t, labels) : null) ??
    t("workspace.workflows.if_else_summary"),
  ConfigForm: eraseForm(WorkflowIfElseForm),
};

// A Filter reads as its condition, like an If/else: "plan is “Pro”".
const filterEntry: TWorkflowNodeRegistryEntry = {
  kind: "filter",
  category: "flow",
  icon: "filter",
  title: (node, t) => node.label ?? t("workspace.workflows.filter"),
  summary: (node, t, labels) =>
    (node.type === "filter" ? describeIfElseCondition(node.config.condition, t, labels) : null) ??
    t("workspace.workflows.filter_summary"),
  ConfigForm: eraseForm(WorkflowFilterForm),
};

// "customer.tier · 2 cases + Default" (mock screen 10).
const switchEntry: TWorkflowNodeRegistryEntry = {
  kind: "switch",
  category: "flow",
  icon: "switch",
  title: (node, t) => node.label ?? t("workspace.workflows.switch"),
  summary: (node, t, labels) =>
    node.type === "switch"
      ? t("workspace.workflows.switch_summary", {
          variable: getVariableDisplayName(node.config.left.path, labels),
          count: node.config.cases.length,
        })
      : "",
  ConfigForm: eraseForm(WorkflowSwitchForm),
};

// The card says whether a sample arrived; the canvas passes that summary in once it knows (it needs
// the server's sample), so this is the summary before that.
const webhookTriggerEntry: TWorkflowNodeRegistryEntry = {
  kind: `trigger:${WORKFLOW_TRIGGERS.WEBHOOK}`,
  category: "trigger",
  icon: "webhook",
  title: (_node, t) => t("workspace.workflows.webhook_trigger"),
  docsUrl: "https://formbricks.com/docs/workflows/webhook-trigger",
  summary: (_node, t) => t("workspace.workflows.webhook_trigger_summary"),
  ConfigForm: eraseForm(WorkflowWebhookTriggerForm),
};

const httpRequestActionEntry: TWorkflowNodeRegistryEntry = {
  kind: `action:${WORKFLOW_ACTIONS.HTTP_REQUEST}`,
  category: "action",
  icon: "http",
  title: (node, t) => node.label ?? t("workspace.workflows.http_request"),
  summary: (node, t) =>
    node.type === "action" && node.actionType === WORKFLOW_ACTIONS.HTTP_REQUEST
      ? (describeHttpRequestTarget(node.config) ?? t("workspace.workflows.http_request_unconfigured"))
      : "",
  ConfigForm: eraseForm(WorkflowHttpRequestForm),
};

const REGISTRY: Record<TWorkflowNodeRegistryKind, TWorkflowNodeRegistryEntry> = {
  "trigger:response.completed": responseCompletedTriggerEntry,
  "trigger:webhook": webhookTriggerEntry,
  "action:send_email": sendEmailActionEntry,
  "action:http_request": httpRequestActionEntry,
  if_else: ifElseEntry,
  filter: filterEntry,
  switch: switchEntry,
};

export const getNodeRegistryKind = (node: TWorkflowNode): TWorkflowNodeRegistryKind => {
  if (node.type === "trigger") return `trigger:${node.triggerType}`;
  if (node.type === "if_else" || node.type === "filter" || node.type === "switch") return node.type;
  return `action:${node.actionType}`;
};

export const getNodeRegistryEntry = (node: TWorkflowNode): TWorkflowNodeRegistryEntry =>
  REGISTRY[getNodeRegistryKind(node)];
