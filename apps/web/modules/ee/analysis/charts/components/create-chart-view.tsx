"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/app/(app)/workspaces/[workspaceId]/context/workspace-context";
import { cn } from "@/lib/cn";
import { isDeepEqual } from "@/lib/utils/object";
import {
  AdvancedChartBuilder,
  type ChartQueryState,
} from "@/modules/ee/analysis/charts/components/advanced-chart-builder";
import { ChartDialogFooter } from "@/modules/ee/analysis/charts/components/chart-dialog-footer";
import { ChartDialogLoadingView } from "@/modules/ee/analysis/charts/components/chart-dialog-loading-view";
import { ChartDisplaySettings } from "@/modules/ee/analysis/charts/components/chart-display-settings";
import { ChartPreview } from "@/modules/ee/analysis/charts/components/chart-preview";
import { ChartTypeSwitch } from "@/modules/ee/analysis/charts/components/chart-type-switch";
import { useChartDialog } from "@/modules/ee/analysis/charts/hooks/use-chart-dialog";
import { hasChartDisplaySettings } from "@/modules/ee/analysis/charts/lib/chart-display";
import { DEFAULT_CHART_TYPE } from "@/modules/ee/analysis/charts/lib/chart-types";
import type { AnalyticsResponse, TChartWithCreator } from "@/modules/ee/analysis/types/analysis";
import { AiIcon } from "@/modules/ui/components/ai";
import { Alert } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
import { ConfirmationModal } from "@/modules/ui/components/confirmation-modal";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/modules/ui/components/dialog";
import { Input } from "@/modules/ui/components/input";
import { Label } from "@/modules/ui/components/label";
import { useBeforeUnloadPrompt } from "@/modules/ui/hooks/use-before-unload-prompt";

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

  /**
   * Dirty means *changed*, not merely populated. Opening a saved chart loads its data straight
   * away, so "has chart data" would flag every read-only visit as unsaved work — which is exactly
   * what it did. Instead, snapshot the state once the dialog has settled and compare against it:
   * a new chart starts from an empty snapshot, so generating or configuring anything counts.
   */
  const currentSnapshot = useMemo(
    () => ({
      name: chartName.trim(),
      type: chartData?.chartType ?? null,
      query: chartData?.query ?? null,
      config: chartConfig ?? null,
    }),
    [chartName, chartData, chartConfig]
  );

  // State rather than a ref: this is read during render to decide whether closing needs to ask.
  const [baseline, setBaseline] = useState<typeof currentSnapshot | null>(null);
  const isReady = open && !isLoadingChart && (!isEditing || Boolean(chartData));

  useEffect(() => {
    if (!open) {
      setBaseline(null);
      return;
    }
    if (isReady && baseline === null) {
      setBaseline(currentSnapshot);
    }
  }, [open, isReady, baseline, currentSnapshot]);

  const hasUnsavedChart = !isSaving && baseline !== null && !isDeepEqual(currentSnapshot, baseline);
  useBeforeUnloadPrompt(() => open && hasUnsavedChart);
  const [isConfirmingDiscard, setIsConfirmingDiscard] = useState(false);
  // What to run once the user confirms — closing and handing off to AI both discard the chart.
  const pendingDiscardActionRef = useRef<(() => void) | null>(null);

  const confirmDiscard = (action: () => void) => {
    if (!hasUnsavedChart) {
      action();
      return;
    }
    pendingDiscardActionRef.current = action;
    setIsConfirmingDiscard(true);
  };

  const requestClose = () => confirmDiscard(handleClose);

  const [chartNameError, setChartNameError] = useState<string | null>(null);
  const [queryState, setQueryState] = useState<ChartQueryState>({
    isLoading: false,
    error: null,
    isPending: false,
  });

  if (isLoadingChart && isEditing && !initialChart) {
    return <ChartDialogLoadingView open={open} onClose={handleClose} />;
  }

  if (isEditing && !isLoadingChart && !chartData && !initialChart && chartLoadError) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <DialogContent width="full">
          <DialogHeader>
            <DialogTitle>{t("common.error")}</DialogTitle>
            <DialogDescription />
          </DialogHeader>
          <DialogBody>
            <div className="flex flex-col items-center justify-center gap-4 py-8">
              <p className="text-sm text-red-600">{chartLoadError}</p>
              <Button variant="outline" onClick={handleClose}>
                {t("common.close")}
              </Button>
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    );
  }

  // Every chart is drawn some way, so the builder is never gated behind picking one: the switch on
  // the preview starts at the default and the user changes it whenever they like.
  const chartType = selectedChartType ?? (isEditing ? initialChart?.type : undefined) ?? DEFAULT_CHART_TYPE;
  const hasSelectedDirectory = !!selectedDirectoryId;
  const isAIQueryAvailable = isAIAvailable !== false;
  const showAIAction = !isEditing && isAIQueryAvailable && Boolean(onRequestAIDialog);
  const canSave = Boolean(chartData) && !queryState.error;

  return (
    <>
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && requestClose()}>
        <DialogContent
          width="full"
          disableCloseOnOutsideClick={!isEditing}
          closeOnEscape
          onOpenAutoFocus={(event) => event.preventDefault()}>
          <DialogHeader>
            <DialogTitle>
              {isEditing
                ? t("workspace.analysis.charts.edit_chart_title")
                : t("workspace.analysis.charts.create_chart")}
            </DialogTitle>
            <DialogDescription>
              {isEditing
                ? t("workspace.analysis.charts.edit_chart_description")
                : t("workspace.analysis.charts.create_chart_description")}
            </DialogDescription>
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
            {hasSelectedDirectory ? (
              <div className="grid min-h-0 flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
                <div className="flex min-h-0 min-w-0 flex-col gap-4 overflow-y-auto px-1 pb-1 lg:pr-3">
                  {/*
                    The name leads the rail: it is what gates saving, it is the one field the AI
                    path arrives with already filled in, and it reads as the first thing you set
                    rather than as chrome bolted onto the header. The form wraps only this field —
                    the footer's Save reaches it through the `form` attribute.
                  */}
                  <form
                    id={CREATE_CHART_FORM_ID}
                    onSubmit={(event) => {
                      event.preventDefault();
                      setChartNameError(null);
                      return handleSaveChart();
                    }}
                    className="flex flex-col gap-2">
                    <Label htmlFor="create-chart-name" className={cn(chartNameError && "text-red-500")}>
                      {t("workspace.analysis.charts.chart_name")}
                    </Label>
                    <Input
                      id="create-chart-name"
                      value={chartName}
                      onChange={(event) => {
                        if (chartNameError) setChartNameError(null);
                        setChartName(event.target.value);
                      }}
                      onInvalid={(event) => {
                        // Suppress the browser tooltip and render our inline message instead.
                        event.preventDefault();
                        event.currentTarget.scrollIntoView({ behavior: "smooth", block: "center" });
                        event.currentTarget.focus();
                        setChartNameError(t("workspace.analysis.charts.please_enter_chart_name"));
                      }}
                      placeholder={t("workspace.analysis.charts.chart_name_placeholder")}
                      maxLength={255}
                      required
                      isInvalid={!!chartNameError}
                    />
                    {chartNameError && <p className="text-sm text-red-500">{chartNameError}</p>}
                  </form>

                  <AdvancedChartBuilder
                    workspaceId={workspaceId}
                    chartType={chartType}
                    initialQuery={chartData?.query ?? initialQuery}
                    onChartGenerated={handleChartGenerated}
                    onQueryStateChange={setQueryState}
                    feedbackDirectoryId={selectedDirectoryId}
                  />
                </div>

                <ChartPreview
                  className="min-h-0 min-w-0"
                  chartData={chartData}
                  config={chartConfig}
                  isLoading={isLoadingChart || queryState.isLoading}
                  error={chartLoadError ?? queryState.error}
                  emptyMessage={t("workspace.analysis.charts.advanced_chart_builder_config_prompt")}
                  typeControl={
                    <ChartTypeSwitch
                      selectedChartType={chartType}
                      onChartTypeSelect={handleChartTypeChange}
                    />
                  }
                  displaySettings={
                    chartData && hasChartDisplaySettings(chartData.chartType) ? (
                      <ChartDisplaySettings
                        chartType={chartData.chartType}
                        config={chartConfig}
                        onChange={setChartConfig}
                      />
                    ) : undefined
                  }
                />
              </div>
            ) : (
              <Alert variant="error" size="small" role="status">
                <div>
                  <p>{t("workspace.analysis.charts.no_data_source_available")}</p>
                  {workspace?.organizationId && (
                    <Link
                      className="mt-1 inline-block font-medium underline"
                      href={`/organizations/${workspace.organizationId}/settings/feedback-directories`}>
                      {t("workspace.analysis.charts.go_to_feedback_directories")}
                    </Link>
                  )}
                </div>
              </Alert>
            )}
          </DialogBody>

          <ChartDialogFooter
            formId={CREATE_CHART_FORM_ID}
            isSaving={isSaving}
            isDisabled={queryState.isPending}
            showAddToDashboard={false}
            canSave={canSave}
            saveHint={t("workspace.analysis.charts.save_requires_chart")}
            onCancelClick={requestClose}
            leadingAction={
              showAIAction ? (
                <Button
                  type="button"
                  variant="ai-secondary"
                  onClick={() => confirmDiscard(() => onRequestAIDialog?.())}>
                  <AiIcon tone="inherit" />
                  {t("workspace.analysis.charts.ai_create.generate_with_ai")}
                </Button>
              ) : undefined
            }
            saveLabel={
              autoAddToDashboardId
                ? t("workspace.analysis.charts.save_and_add_to_dashboard")
                : t("workspace.analysis.charts.save_chart")
            }
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
        onConfirm={() => {
          setIsConfirmingDiscard(false);
          const action = pendingDiscardActionRef.current;
          pendingDiscardActionRef.current = null;
          action?.();
        }}
      />
    </>
  );
}
