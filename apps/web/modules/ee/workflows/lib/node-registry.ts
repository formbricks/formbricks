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
import { WorkflowIfElseForm } from "@/modules/ee/workflows/components/inspector/workflow-if-else-form";
import { WorkflowTriggerForm } from "@/modules/ee/workflows/components/inspector/workflow-trigger-form";
import { WorkflowWebhookTriggerForm } from "@/modules/ee/workflows/components/inspector/workflow-webhook-trigger-form";
import { describeHttpRequestTarget } from "@/modules/ee/workflows/lib/http-request-panel";
import { describeIfElseCondition } from "@/modules/ee/workflows/lib/if-else-summary";
import { getVariableDisplayName } from "@/modules/ee/workflows/lib/variable-name";
import type { TWorkflowNodeCategory, TWorkflowNodeIcon } from "@/modules/ee/workflows/state/editor";

export type TWorkflowNodeRegistryKind =
  | `trigger:${(typeof WORKFLOW_TRIGGERS)[keyof typeof WORKFLOW_TRIGGERS]}`
  | `action:${(typeof WORKFLOW_ACTIONS)[keyof typeof WORKFLOW_ACTIONS]}`
  | "if_else";

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
  summary: (node: TWorkflowNode, t: TFunction) => string;
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
  icon: "trigger",
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
  summary: (node, t) => {
    if (node.type !== "action" || node.actionType !== WORKFLOW_ACTIONS.SEND_EMAIL) return "";
    const { to, surveyLink } = node.config;
    // A Variable recipient reads as the picker shows it: "@customer.email".
    const recipient = isVariableEmailRecipient(to) ? `@${getVariableDisplayName(to.ref)}` : to;
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
  summary: (node, t) =>
    (node.type === "if_else" ? describeIfElseCondition(node.config.condition, t) : null) ??
    t("workspace.workflows.if_else_summary"),
  ConfigForm: eraseForm(WorkflowIfElseForm),
};

// The card says whether a sample arrived; the canvas passes that summary in once it knows (it needs
// the server's sample), so this is the summary before that.
const webhookTriggerEntry: TWorkflowNodeRegistryEntry = {
  kind: `trigger:${WORKFLOW_TRIGGERS.WEBHOOK}`,
  category: "trigger",
  icon: "webhook",
  title: (_node, t) => t("workspace.workflows.webhook_trigger"),
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
};

export const getNodeRegistryKind = (node: TWorkflowNode): TWorkflowNodeRegistryKind => {
  if (node.type === "trigger") return `trigger:${node.triggerType}`;
  if (node.type === "if_else") return "if_else";
  return `action:${node.actionType}`;
};

export const getNodeRegistryEntry = (node: TWorkflowNode): TWorkflowNodeRegistryEntry =>
  REGISTRY[getNodeRegistryKind(node)];
