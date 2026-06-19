"use client";

import { Provider as JotaiProvider, useAtomValue, useSetAtom } from "jotai";
import { ArchiveIcon, ArchiveRestoreIcon, PowerIcon, PowerOffIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { TWorkflowStatus } from "@formbricks/workflows";
import { Button } from "@/modules/ui/components/button";
import { Input } from "@/modules/ui/components/input";
import { WorkflowCanvas } from "@/modules/workflows/canvas/workflow-canvas";
import { WorkflowInspectorPanel } from "@/modules/workflows/components/workflow-inspector-panel";
import { WorkflowNodeConfigModal } from "@/modules/workflows/components/workflow-node-config-modal";
import { useWorkflowBuilder } from "@/modules/workflows/hooks/use-workflow-builder";
import { WorkflowBuilderBodyLoading } from "@/modules/workflows/loading";
import {
  setWorkflowDescriptionAtom,
  setWorkflowNameAtom,
  workflowDescriptionAtom,
  workflowNameAtom,
} from "@/modules/workflows/state/editor";

interface WorkflowBuilderPageProps {
  workspaceId: string;
  workflowId: string;
  isReadOnly: boolean;
}

const WorkflowBuilderHeaderRow = ({
  isEditable,
  isSaving,
  isTransitioning,
  status,
  onSave,
  onEnable,
  onDisable,
  onArchive,
  onUnarchive,
}: {
  isEditable: boolean;
  isSaving: boolean;
  isTransitioning: boolean;
  status: TWorkflowStatus;
  onSave: () => void;
  onEnable: () => void;
  onDisable: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
}) => {
  const { t } = useTranslation();
  const workflowName = useAtomValue(workflowNameAtom);
  const workflowDescription = useAtomValue(workflowDescriptionAtom);
  const setWorkflowName = useSetAtom(setWorkflowNameAtom);
  const setWorkflowDescription = useSetAtom(setWorkflowDescriptionAtom);

  // Single-row builder header: Name input, Description input, and lifecycle buttons all align
  // on one baseline so the canvas below gets the maximum vertical real estate. The status badge
  // already lives in the page header, so it's intentionally absent here.
  return (
    <div className="flex flex-wrap items-end gap-4">
      <label className="flex min-w-[200px] flex-1 flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">
          {t("workspace.workflows.workflow_name_label")}
        </span>
        <Input
          value={workflowName}
          disabled={!isEditable}
          className="bg-white"
          onChange={(event) => setWorkflowName(event.target.value)}
        />
      </label>
      <label className="flex min-w-[240px] flex-1 flex-col gap-2">
        <span className="text-sm font-medium text-slate-700">
          {t("workspace.workflows.workflow_description_label")}
        </span>
        <Input
          value={workflowDescription}
          disabled={!isEditable}
          className="bg-white"
          placeholder={t("workspace.workflows.workflow_description_placeholder")}
          onChange={(event) => setWorkflowDescription(event.target.value)}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2 pb-0.5">
        {status === "archived" ? (
          <Button type="button" size="sm" onClick={onUnarchive} loading={isTransitioning}>
            <ArchiveRestoreIcon />
            {t("common.unarchive")}
          </Button>
        ) : (
          <>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={onArchive}
              loading={isTransitioning}>
              <ArchiveIcon />
              {t("common.archive")}
            </Button>
            {status === "enabled" ? (
              <Button type="button" size="sm" onClick={onDisable} loading={isTransitioning}>
                <PowerOffIcon />
                {t("common.disable")}
              </Button>
            ) : (
              <Button type="button" size="sm" onClick={onEnable} loading={isTransitioning}>
                <PowerIcon />
                {t("common.enable")}
              </Button>
            )}
            <Button type="button" size="sm" onClick={onSave} loading={isSaving} disabled={!isEditable}>
              {t("common.save")}
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

const WorkflowBuilderPageContent = ({
  workflowId,
  isReadOnly,
}: Omit<WorkflowBuilderPageProps, "workspaceId">) => {
  const builder = useWorkflowBuilder({ workflowId, isReadOnly });

  if (builder.isLoading) {
    return <WorkflowBuilderBodyLoading />;
  }

  if (!builder.workflow) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
        {builder.loadError ?? "Failed to load workflow."}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-slate-100 p-4">
      <WorkflowBuilderHeaderRow
        isEditable={builder.canEdit}
        isSaving={builder.isSaving}
        isTransitioning={builder.isTransitioning}
        status={builder.workflow.status}
        onSave={builder.save}
        onEnable={builder.enable}
        onDisable={builder.disable}
        onArchive={builder.archive}
        onUnarchive={builder.unarchive}
      />
      <section className="flex min-h-[680px] gap-4">
        <WorkflowCanvas isEditable={builder.canEdit} />
        <WorkflowInspectorPanel isEditable={builder.canEdit} />
      </section>
      <WorkflowNodeConfigModal isEditable={builder.canEdit} />
    </div>
  );
};

export const WorkflowBuilderPage = (props: Readonly<WorkflowBuilderPageProps>) => (
  <JotaiProvider>
    <WorkflowBuilderPageContent {...props} />
  </JotaiProvider>
);
