"use client";

import { Alert, AlertDescription, AlertTitle } from "@/modules/ui/components/alert";
import { Badge } from "@/modules/ui/components/badge";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import { SparklesIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

interface EnableInsightsBannerProps {
  surveyId: string;
  maxResponseCount: number;
  surveyResponseCount: number;
}

export const EnableInsightsBanner = ({
  surveyId,
  surveyResponseCount,
  maxResponseCount,
}: EnableInsightsBannerProps) => {
  const { t } = useTranslate();
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  const handleInsightGeneration = async () => {
    toast.success("Generating insights for this survey. Please check back in a few minutes.", {
      duration: 3000,
    });
    setIsGeneratingInsights(true);
    toast.success(t("environments.surveys.summary.enable_ai_insights_banner_success"));
  };

  if (isGeneratingInsights) {
    return null;
  }

  return (
    <Alert className="mb-6 mt-4 flex items-center gap-4 border-slate-400 bg-white">
      <div>
        <SparklesIcon strokeWidth={1.5} className="size-7 text-slate-700" />
      </div>
      <div className="flex-1">
        <AlertTitle>
          <span className="mr-2">{t("environments.surveys.summary.enable_ai_insights_banner_title")}</span>
          <Badge type="gray" size="normal" text="Beta" />
        </AlertTitle>
        <AlertDescription className="flex items-start justify-between gap-4">
          {t("environments.surveys.summary.enable_ai_insights_banner_description")}
        </AlertDescription>
      </div>
      <TooltipRenderer
        tooltipContent={
          surveyResponseCount > maxResponseCount
            ? t("environments.surveys.summary.enable_ai_insights_banner_tooltip")
            : undefined
        }>
        <Button
          size="sm"
          className="shrink-0"
          onClick={handleInsightGeneration}
          loading={isGeneratingInsights}
          disabled={surveyResponseCount > maxResponseCount}>
          {t("environments.surveys.summary.enable_ai_insights_banner_button")}
        </Button>
      </TooltipRenderer>
    </Alert>
  );
};
