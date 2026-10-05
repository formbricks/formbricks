"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { CreateChartChooserDialog } from "@/modules/ee/analysis/charts/components/create-chart-chooser-dialog";
import { CreateChartDialog } from "@/modules/ee/analysis/charts/components/create-chart-dialog";
import { CreateChartWithAIDialog } from "@/modules/ee/analysis/charts/components/create-chart-with-ai-dialog";
import {
  getChartPresetCopy,
  presetToAnalyticsResponse,
} from "@/modules/ee/analysis/charts/lib/chart-presets";
import type { AnalyticsResponse } from "@/modules/ee/analysis/types/analysis";
import { Button, type ButtonProps } from "@/modules/ui/components/button";

interface CreateChartButtonProps {
  workspaceId: string;
  directories: { id: string; name: string }[];
  autoAddToDashboardId?: string;
  label?: string;
  onSuccess?: () => void;
  showIcon?: boolean;
  buttonProps?: Omit<ButtonProps, "onClick" | "children">;
  isAIAvailable?: boolean;
  aiUnavailableReason?: TAIUnavailableReason;
}

export function CreateChartButton({
  workspaceId,
  directories,
  autoAddToDashboardId,
  label,
  onSuccess,
  showIcon = true,
  buttonProps,
  isAIAvailable,
  aiUnavailableReason,
}: Readonly<CreateChartButtonProps>) {
  const [isChooserOpen, setIsChooserOpen] = useState(false);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  /** A chart handed over by the AI dialog, opened straight into the builder for review and naming. */
  const [generatedChart, setGeneratedChart] = useState<AnalyticsResponse | null>(null);
  /** Held here, not in the dialog, so it survives the trip to the builder and back. */
  const [aiPrompt, setAiPrompt] = useState("");
  const { t } = useTranslation();

  const buttonLabel = label ?? t("workspace.analysis.charts.new_chart");

  const openBuilder = (chart: AnalyticsResponse | null) => {
    setGeneratedChart(chart);
    setIsBuilderOpen(true);
  };

  return (
    <>
      <Button size="sm" onClick={() => setIsChooserOpen(true)} {...buttonProps}>
        {showIcon && <PlusIcon className="mr-2 size-4" />}
        {buttonLabel}
      </Button>

      <CreateChartChooserDialog
        open={isChooserOpen}
        onOpenChange={setIsChooserOpen}
        directoryName={directories[0]?.name}
        isAIAvailable={isAIAvailable}
        aiUnavailableReason={aiUnavailableReason}
        onBlank={() => {
          setIsChooserOpen(false);
          openBuilder(null);
        }}
        onPreset={(presetId) => {
          setIsChooserOpen(false);
          openBuilder(presetToAnalyticsResponse(presetId, getChartPresetCopy(t)[presetId].name));
        }}
        onDescribe={() => {
          setIsChooserOpen(false);
          setIsAIDialogOpen(true);
        }}
      />

      <CreateChartWithAIDialog
        open={isAIDialogOpen}
        onOpenChange={setIsAIDialogOpen}
        workspaceId={workspaceId}
        feedbackDirectoryId={directories[0]?.id ?? null}
        onChartGenerated={openBuilder}
        prompt={aiPrompt}
        onPromptChange={setAiPrompt}
        isAIAvailable={isAIAvailable}
        aiUnavailableReason={aiUnavailableReason}
      />

      <CreateChartDialog
        open={isBuilderOpen}
        onOpenChange={(open) => {
          setIsBuilderOpen(open);
          if (!open) setGeneratedChart(null);
        }}
        workspaceId={workspaceId}
        autoAddToDashboardId={autoAddToDashboardId}
        directories={directories}
        generatedChart={generatedChart}
        onSuccess={onSuccess}
      />
    </>
  );
}
