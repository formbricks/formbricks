"use client";

import { useAtomValue, useSetAtom } from "jotai";
import { PanelLeftIcon, PanelRightOpenIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/modules/ui/components/button";
import { AiAssistantSection } from "@/modules/workflows/components/inspector/workflow-ai-assistant-section";
import { HistorySection } from "@/modules/workflows/components/inspector/workflow-history-section";
import { SettingsSection } from "@/modules/workflows/components/inspector/workflow-settings-section";
import {
  getPlaceholderWorkflowHistory,
  getPlaceholderWorkflowSettings,
} from "@/modules/workflows/lib/placeholder-data";
import {
  isWorkflowInspectorCollapsedAtom,
  toggleWorkflowInspectorAtom,
  workflowAtom,
  workflowDefinitionAtom,
} from "@/modules/workflows/state/editor";

interface WorkflowInspectorPanelProps {
  workflowId: string;
  isReadOnly: boolean;
  isEditable: boolean;
}

/**
 * Right-side inspector for the workflow builder. Composes three workflow-level sections —
 * Formbricks AI assistant, Settings, History — and a collapse/expand toggle. Each section is its
 * own component so they stay small and easy to swap when the real data sources land.
 */
export const WorkflowInspectorPanel = ({
  workflowId,
  isReadOnly,
  isEditable,
}: Readonly<WorkflowInspectorPanelProps>) => {
  const { t } = useTranslation();
  const workflow = useAtomValue(workflowAtom);
  const definition = useAtomValue(workflowDefinitionAtom);
  const isCollapsed = useAtomValue(isWorkflowInspectorCollapsedAtom);
  const toggleCollapsed = useSetAtom(toggleWorkflowInspectorAtom);
  const settings = workflow ? getPlaceholderWorkflowSettings(workflow.id) : undefined;
  const history = workflow ? getPlaceholderWorkflowHistory(workflow.id) : undefined;

  if (isCollapsed) {
    return (
      <aside className="flex w-12 shrink-0 flex-col items-center gap-2 pt-2">
        <Button
          aria-label={t("workspace.workflows.expand_inspector")}
          size="icon"
          title={t("workspace.workflows.expand_inspector")}
          type="button"
          variant="outline"
          className="bg-white"
          onClick={toggleCollapsed}>
          <PanelRightOpenIcon />
        </Button>
      </aside>
    );
  }

  const triggerNode = definition?.trigger;
  const hasEndingFilter = triggerNode ? triggerNode.config.endingCardIds.length > 0 : false;
  const overviewText =
    settings?.aiOverview ??
    workflow?.description ??
    (hasEndingFilter
      ? t("workspace.workflows.overview_trigger_with_endings")
      : t("workspace.workflows.overview_trigger_any_response"));

  return (
    <aside className="flex w-[320px] shrink-0 flex-col gap-3 self-start">
      <div className="flex justify-start">
        <Button
          aria-label={t("workspace.workflows.collapse_inspector")}
          size="icon"
          title={t("workspace.workflows.collapse_inspector")}
          variant="outline"
          className="bg-white"
          type="button"
          onClick={toggleCollapsed}>
          <PanelLeftIcon />
        </Button>
      </div>

      <AiAssistantSection overviewText={overviewText} />
      <SettingsSection
        workflowId={workflowId}
        isReadOnly={isReadOnly}
        isEditable={isEditable}
        settings={settings}
      />
      <HistorySection history={history} />
    </aside>
  );
};
