"use client";

import { ChevronDownIcon, PlusCircleIcon, PlusIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TAIUnavailableReason } from "@/lib/ai/service";
import { CreateChartDialog } from "@/modules/ee/analysis/charts/components/create-chart-dialog";
import { CreateChartWithAIDialog } from "@/modules/ee/analysis/charts/components/create-chart-with-ai-dialog";
import type { AnalyticsResponse } from "@/modules/ee/analysis/types/analysis";
import { AiIcon } from "@/modules/ui/components/ai";
import { Button, type ButtonProps } from "@/modules/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/modules/ui/components/dropdown-menu";

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
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [isAIDialogOpen, setIsAIDialogOpen] = useState(false);
  /** A chart handed over by the AI dialog, opened straight into the builder for review and naming. */
  const [generatedChart, setGeneratedChart] = useState<AnalyticsResponse | null>(null);
  /** Held here, not in the dialog, so it survives the trip to the builder and back. */
  const [aiPrompt, setAiPrompt] = useState("");
  const { t } = useTranslation();

  const buttonLabel = label ?? t("workspace.analysis.charts.new_chart");
  const canUseAI = isAIAvailable !== false;

  const openBuilder = (chart: AnalyticsResponse | null) => {
    setGeneratedChart(chart);
    setIsBuilderOpen(true);
  };

  return (
    <>
      {canUseAI ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" {...buttonProps}>
              {buttonLabel}
              <ChevronDownIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            {/* Building by hand leads: it is the path that always produces the chart someone asked
                for. AI generation sits second and says Beta, because it reads the dataset's sources
                and questions but still guesses at everything else. */}
            <DropdownMenuItem icon={<PlusCircleIcon className="size-4" />} onSelect={() => openBuilder(null)}>
              {t("workspace.analysis.charts.from_scratch")}
            </DropdownMenuItem>
            <DropdownMenuItem icon={<AiIcon />} onSelect={() => setIsAIDialogOpen(true)}>
              {t("workspace.analysis.charts.ai_create.generate_with_ai_beta")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        // With AI off there is only one way to start, and a one-item dropdown is just a worse button.
        <Button size="sm" onClick={() => openBuilder(null)} {...buttonProps}>
          {showIcon && <PlusIcon className="mr-2 size-4" />}
          {buttonLabel}
        </Button>
      )}

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
