"use client";

import { useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { AiAssistantSection } from "@/modules/workflows/components/inspector/workflow-ai-assistant-section";
import { WorkflowNodeConfigPanel } from "@/modules/workflows/components/inspector/workflow-node-config-panel";
import { SettingsSection } from "@/modules/workflows/components/inspector/workflow-settings-section";
import {
  isWorkflowInspectorCollapsedAtom,
  isWorkflowNodeConfigModalOpenAtom,
  workflowAtom,
  workflowDefinitionAtom,
} from "@/modules/workflows/state/editor";

interface WorkflowInspectorPanelProps {
  canEditDefinition: boolean;
  canEditMetadata: boolean;
  isEditingNode: boolean;
  onSaveNode?: () => Promise<void> | void;
  isSavingNode?: boolean;
}

export const WorkflowInspectorPanel = ({
  canEditDefinition,
  canEditMetadata,
  isEditingNode,
  onSaveNode,
  isSavingNode,
}: Readonly<WorkflowInspectorPanelProps>) => {
  const { t } = useTranslation();
  const workflow = useAtomValue(workflowAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  const isCollapsed = useAtomValue(isWorkflowInspectorCollapsedAtom);
  const isNodeConfigOpen = useAtomValue(isWorkflowNodeConfigModalOpenAtom);

  if (isCollapsed) return null;

  if (isNodeConfigOpen) {
    return <WorkflowNodeConfigPanel isEditable={isEditingNode} onSave={onSaveNode} isSaving={isSavingNode} />;
  }

  const triggerNode = definition?.trigger;
  const hasEndingFilter = triggerNode ? triggerNode.config.endingCardIds.length > 0 : false;
  const description = workflow?.description?.trim();
  const fallbackOverviewKey = hasEndingFilter
    ? "workspace.workflows.overview_trigger_with_endings"
    : "workspace.workflows.overview_trigger_any_response";
  const overviewText = description && description.length > 0 ? description : t(fallbackOverviewKey);

  return (
    <aside className="flex w-[320px] shrink-0 flex-col gap-3 self-start">
      <AiAssistantSection overviewText={overviewText} />
      <SettingsSection canEditDefinition={canEditDefinition} canEditMetadata={canEditMetadata} />
    </aside>
  );
};
