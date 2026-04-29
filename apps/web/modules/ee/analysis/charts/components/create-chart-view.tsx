"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { AdvancedChartBuilder } from "@/modules/ee/analysis/charts/components/advanced-chart-builder";
import { AIQuerySection } from "@/modules/ee/analysis/charts/components/ai-query-section";
import { ChartDialogFooter } from "@/modules/ee/analysis/charts/components/chart-dialog-footer";
import { ChartDialogLoadingView } from "@/modules/ee/analysis/charts/components/chart-dialog-loading-view";
import { ChartPreview } from "@/modules/ee/analysis/charts/components/chart-preview";
import { ManualChartBuilder } from "@/modules/ee/analysis/charts/components/manual-chart-builder";
import { useChartDialog } from "@/modules/ee/analysis/charts/hooks/use-chart-dialog";
import { DEFAULT_CHART_TYPE } from "@/modules/ee/analysis/charts/lib/chart-types";
import type { TChartWithCreator } from "@/modules/ee/analysis/types/analysis";
import { Alert } from "@/modules/ui/components/alert";
import { Button } from "@/modules/ui/components/button";
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

interface CreateChartViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceId: string;
  chartId?: string;
  initialChart?: TChartWithCreator;
  autoAddToDashboardId?: string;
  onSuccess?: () => void;
  directories: { id: string; name: string }[];
}

export function CreateChartView({
  open,
  onOpenChange,
  workspaceId,
  chartId,
  initialChart,
  autoAddToDashboardId,
  onSuccess,
  directories,
}: Readonly<CreateChartViewProps>) {
  const { t } = useTranslation();
  const isEditing = !!chartId;

  const {
    chartData,
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

  const chartPreviewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chartData) {
      chartPreviewRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [chartData]);

  if (isLoadingChart && isEditing && !initialChart) {
    return <ChartDialogLoadingView open={open} onClose={handleClose} />;
  }

  if (isEditing && !isLoadingChart && !chartData && !initialChart && chartLoadError) {
    return (
      <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
        <DialogContent width="wide">
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

  const chartType = selectedChartType ?? (isEditing ? (initialChart?.type ?? DEFAULT_CHART_TYPE) : undefined);
  const hasSelectedDirectory = !!selectedDirectoryId;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto"
        width="wide"
        disableCloseOnOutsideClick={!isEditing}>
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
        <DialogBody>
          <div className="grid gap-4">
            {hasSelectedDirectory ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="create-chart-name">{t("workspace.analysis.charts.chart_name")}</Label>
                  <Input
                    id="create-chart-name"
                    value={chartName}
                    onChange={(event) => setChartName(event.target.value)}
                    placeholder={t("workspace.analysis.charts.chart_name_placeholder")}
                    maxLength={255}
                    required
                  />
                </div>

                {!isEditing && (
                  <>
                    <AIQuerySection
                      workspaceId={workspaceId}
                      onChartGenerated={handleChartGenerated}
                      feedbackRecordDirectoryId={selectedDirectoryId}
                    />

                    <div className="relative">
                      <div className="absolute inset-0 flex items-center" aria-hidden="true">
                        <div className="w-full border-t border-gray-200" />
                      </div>
                      <div className="relative flex justify-center">
                        <span className="bg-white px-2 text-sm text-gray-500">
                          {t("workspace.analysis.charts.OR")}
                        </span>
                      </div>
                    </div>
                  </>
                )}

                <ManualChartBuilder selectedChartType={chartType} onChartTypeSelect={handleChartTypeChange} />

                {chartType && (
                  <AdvancedChartBuilder
                    workspaceId={workspaceId}
                    chartType={chartType}
                    initialQuery={chartData?.query ?? initialQuery}
                    hidePreview={true}
                    onChartGenerated={handleChartGenerated}
                    feedbackRecordDirectoryId={selectedDirectoryId}
                    runQueryCtaLabel={
                      chartData
                        ? t("workspace.analysis.charts.update_chart")
                        : t("workspace.analysis.charts.preview_chart")
                    }
                  />
                )}

                {(isEditing || chartData) && (
                  <div ref={chartPreviewRef}>
                    <ChartPreview chartData={chartData} isLoading={isLoadingChart} error={chartLoadError} />
                  </div>
                )}
              </>
            ) : (
              <Alert variant="error" size="small">
                <div>
                  <p>{t("workspace.analysis.charts.no_data_source_available")}</p>
                  <Link
                    className="mt-1 inline-block font-medium underline"
                    href={`/workspaces/${workspaceId}/settings/feedback-record-directories`}>
                    {t("workspace.analysis.charts.go_to_feedback_record_directories")}
                  </Link>
                </div>
              </Alert>
            )}
          </div>
        </DialogBody>

        {chartData && (
          <ChartDialogFooter
            onSaveClick={handleSaveChart}
            isSaving={isSaving}
            showAddToDashboard={false}
            saveLabel={
              autoAddToDashboardId
                ? t("workspace.analysis.charts.save_and_add_to_dashboard")
                : t("workspace.analysis.charts.save_chart")
            }
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
