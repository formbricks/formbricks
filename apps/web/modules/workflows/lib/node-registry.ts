import type { TFunction } from "i18next";
import type { ComponentType } from "react";
import {
  type TWorkflowNode,
  type TWorkflowResponseCompletedTriggerNode,
  type TWorkflowSendEmailActionNode,
  WORKFLOW_ACTIONS,
  WORKFLOW_TRIGGERS,
} from "@formbricks/workflows";
import { WorkflowEmailActionForm } from "@/modules/workflows/components/inspector/workflow-email-action-form";
import { WorkflowTriggerForm } from "@/modules/workflows/components/inspector/workflow-trigger-form";
import type { TWorkflowNodeCategory, TWorkflowNodeIcon } from "@/modules/workflows/state/editor";

/**
 * Registry of node-kind metadata used by the canvas and inspector. Adding a new action type =
 * one entry here; the canvas projection picks up the new icon/title/summary automatically, and
 * the inspector forwards the matching `ConfigForm`.
 */

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
    if (node.type !== "trigger") return "";
    const triggerNode = node as TWorkflowResponseCompletedTriggerNode;
    return triggerNode.config.endingCardIds.length > 0
      ? t("workspace.workflows.trigger_summary_ending_cards", {
          count: triggerNode.config.endingCardIds.length,
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
    const actionNode = node as TWorkflowSendEmailActionNode;
    return actionNode.config.to
      ? t("workspace.workflows.send_email_summary", { to: actionNode.config.to })
      : t("workspace.workflows.send_email_unconfigured");
  },
  ConfigForm: eraseForm(WorkflowEmailActionForm),
};

const ifElseEntry: TWorkflowNodeRegistryEntry = {
  kind: "if_else",
  category: "flow",
  icon: "ifElse",
  title: (_node, t) => t("workspace.workflows.if_else"),
  summary: (_node, t) => t("workspace.workflows.if_else_summary"),
  ConfigForm: null,
};

const REGISTRY: Record<TWorkflowNodeRegistryKind, TWorkflowNodeRegistryEntry> = {
  "trigger:response.completed": responseCompletedTriggerEntry,
  "action:send_email": sendEmailActionEntry,
  if_else: ifElseEntry,
};

export const getNodeRegistryKind = (node: TWorkflowNode): TWorkflowNodeRegistryKind => {
  if (node.type === "trigger") return `trigger:${node.triggerType}`;
  if (node.type === "if_else") return "if_else";
  return `action:${node.actionType}`;
};

export const getNodeRegistryEntry = (node: TWorkflowNode): TWorkflowNodeRegistryEntry =>
  REGISTRY[getNodeRegistryKind(node)];
