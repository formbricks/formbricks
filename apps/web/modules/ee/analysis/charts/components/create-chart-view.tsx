"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import type { ChartQueryState } from "@/modules/ee/analysis/charts/components/advanced-chart-builder";
import { ChartBuilderBody } from "@/modules/ee/analysis/charts/components/chart-builder-body";
import { ChartDialogFooter } from "@/modules/ee/analysis/charts/components/chart-dialog-footer";
import { ChartDialogLoadingView } from "@/modules/ee/analysis/charts/components/chart-dialog-loading-view";
import { ChartLoadErrorDialog } from "@/modules/ee/analysis/charts/components/chart-load-error-dialog";
import { NoFeedbackDirectoryAlert } from "@/modules/ee/analysis/charts/components/no-feedback-directory-alert";
import { useChartDialog } from "@/modules/ee/analysis/charts/hooks/use-chart-dialog";
import { useChartDirtyState } from "@/modules/ee/analysis/charts/hooks/use-chart-dirty-state";
import { DEFAULT_CHART_TYPE } from "@/modules/ee/analysis/charts/lib/chart-types";
import type { AnalyticsResponse, TChartWithCreator } from "@/modules/ee/analysis/types/analysis";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";

interface CreateChartViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  chartId?: string;
  initialChart?: TChartWithCreator;
  generatedChart?: AnalyticsResponse | null;
  onRequestAIDialog?: () => void;
  autoAddToDashboardId?: string;
  onSuccess?: () => void;
  directories: { id: string; name: string }[];
  isAIAvailable?: boolean;
}

const CREATE_CHART_FORM_ID = "create-chart-form";

export function CreateChartView({
  open,
  onOpenChange,
  workspaceId,
  chartId,
  initialChart,
  generatedChart,
  onRequestAIDialog,
  autoAddToDashboardId,
  onSuccess,
  directories,
  isAIAvailable,
}: Readonly<CreateChartViewProps>) {
  const { t } = useTranslation();
  const { workspace } = useWorkspace();
  const isEditing = !!chartId;

  const {
    chartData,
    chartConfig,
    setChartConfig,
    initialQuery,
    isLoadingChart,
    chartLoadError,
    chartName,
    setChartName,
    selectedChartType,
    handleChartTypeChange,
    handleChartGenerated,
    handleSaveChart,
    isSaving,
    selectedDirectoryId,
    handleClose,
  } = useChartDialog({
    open,
    onOpenChange,
    workspaceId,
    chartId,
    initialChart,
    autoAddToDashboardId,
    onSuccess,
    directories,
  });

  // A chart arriving from the AI dialog is adopted once, then treated like any other draft the
  // user is editing — so a later manual change is never overwritten by the same hand-off.
  const adoptedChartRef = useRef<AnalyticsResponse | null>(null);
  useEffect(() => {
    if (!open || !generatedChart || adoptedChartRef.current === generatedChart) return;
    adoptedChartRef.current = generatedChart;
    handleChartGenerated(generatedChart);
  }, [open, generatedChart, handleChartGenerated]);

  useEffect(() => {
    if (!open) adoptedChartRef.current = null;
  }, [open]);

  const isReady = open && !isLoadingChart && (!isEditing || Boolean(chartData));
  const { confirmDiscard, isConfirmingDiscard, setIsConfirmingDiscard, runPendingDiscard } =
    useChartDirtyState({ open, isReady, isSaving, chartName, chartData, chartConfig });

  const requestClose = () => confirmDiscard(handleClose);
  const handleDialogOpenChange = (isOpen: boolean) => {
    if (!isOpen) requestClose();
  };

  const [queryState, setQueryState] = useState<ChartQueryState>({
    isLoading: false,
    error: null,
    isPending: false,
  });

  if (isLoadingChart && isEditing && !initialChart) {
    return <ChartDialogLoadingView open={open} onClose={handleClose} />;
  }

  if (isEditing && !isLoadingChart && !chartData && !initialChart && chartLoadError) {
    return <ChartLoadErrorDialog open={open} message={chartLoadError} onClose={handleClose} />;
  }

  // Every chart is drawn some way, so the builder is never gated behind picking one: the switch on
  // the preview starts at the default and the user changes it whenever they like.
  const chartType = selectedChartType ?? initialChart?.type ?? DEFAULT_CHART_TYPE;

  const isAIQueryAvailable = isAIAvailable !== false;
  const showAIAction = !isEditing && isAIQueryAvailable && Boolean(onRequestAIDialog);
  const canSave = Boolean(chartData) && !queryState.error;
  // Close through handleClose rather than letting the parent flip the dialog shut: leaving for the
  // AI dialog ends this builder session, and a session that ends without a reset leaves its chart
  // behind for the next one to open on top of.
  const requestAI = showAIAction
    ? () =>
        confirmDiscard(() => {
          handleClose();
          onRequestAIDialog?.();
        })
    : undefined;
  const saveLabel = autoAddToDashboardId
    ? t("workspace.analysis.charts.save_and_add_to_dashboard")
    : t("workspace.analysis.charts.save_chart");
  const copy = isEditing
    ? {
        title: t("workspace.analysis.charts.edit_chart_title"),
        description: t("workspace.analysis.charts.edit_chart_description"),
      }
    : {
        title: t("workspace.analysis.charts.create_chart"),
        description: t("workspace.analysis.charts.create_chart_description"),
      };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent
          width="full"
          disableCloseOnOutsideClick={!isEditing}
          closeOnEscape
          onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{copy.title}</DialogTitle>
            <DialogDescription>{copy.description}</DialogDescription>
          </DialogHeader>

          {/*
            Two regions that each mean one thing: a rail of everything you set, and a stage showing
            what that produces. Only the rail scrolls, so the chart, its type and its display
            settings are all on screen at once however long the configuration gets.
          */}
          <DialogBody
            unconstrained
            // Fixed height, with DialogBody's own `flex-1` neutralised (`basis-auto grow-0`): a 0%
            // flex basis wins over `height` on the main axis, which had the dialog resizing itself
            // every time the preview swapped between empty, loading and rendered. `shrink` keeps it
            // clamped on a short viewport.
            className="flex h-[34rem] min-h-0 shrink grow-0 basis-auto flex-col overflow-y-auto lg:overflow-hidden">
            {selectedDirectoryId ? (
              <ChartBuilderBody
                formId={CREATE_CHART_FORM_ID}
                workspaceId={workspaceId}
                feedbackDirectoryId={selectedDirectoryId}
                chartType={chartType}
                chartData={chartData}
                chartConfig={chartConfig}
                onChartConfigChange={setChartConfig}
                initialQuery={initialQuery}
                chartName={chartName}
                onChartNameChange={setChartName}
                onSave={handleSaveChart}
                onChartTypeSelect={handleChartTypeChange}
                onChartGenerated={handleChartGenerated}
                onQueryStateChange={setQueryState}
                queryState={queryState}
                isLoadingChart={isLoadingChart}
                chartLoadError={chartLoadError}
                onRequestAI={requestAI}
              />
            ) : (
              <NoFeedbackDirectoryAlert organizationId={workspace?.organizationId} />
            )}
          </DialogBody>

          <ChartDialogFooter
            formId={CREATE_CHART_FORM_ID}
            isSaving={isSaving}
            isDisabled={queryState.isPending}
            showAddToDashboard={false}
            canSave={canSave}
            onCancelClick={requestClose}
            saveLabel={saveLabel}
          />
        </DialogContent>
      </Dialog>

      <ConfirmationModal
        open={isConfirmingDiscard}
        setOpen={setIsConfirmingDiscard}
        title={t("workspace.analysis.charts.discard_chart_title")}
        body={t("workspace.analysis.charts.discard_chart_body")}
        buttonText={t("workspace.surveys.ai_create.discard")}
        buttonVariant="destructive"
        cancelButtonText={t("workspace.surveys.ai_create.keep_editing")}
        onConfirm={runPendingDiscard}
      />
    </>
  );
}
