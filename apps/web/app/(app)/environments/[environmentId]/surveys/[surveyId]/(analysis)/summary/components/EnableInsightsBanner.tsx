"use client";

import { generateInsightsForSurveyAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { SparklesIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Alert, AlertDescription, AlertTitle } from "@formbricks/ui/components/Alert";
import { Badge } from "@formbricks/ui/components/Badge";
import { Button } from "@formbricks/ui/components/Button";

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
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  const handleInsightGeneration = async () => {
    setIsGeneratingInsights(true);
    toast.success("Generating insights for this survey. Please check back in a few minutes.");
    generateInsightsForSurveyAction({ surveyId });
  };

  return (
    <Alert className="mb-6 mt-4 flex items-center gap-4 border-slate-400 bg-white">
      <div>
        <SparklesIcon strokeWidth={1.5} className="size-7 text-slate-700" />
      </div>
      <div className="flex-1">
        <AlertTitle>
          <span className="mr-2">Ready to test AI insights?</span>
          <Badge text="Beta" type="gray" size="normal" />
        </AlertTitle>
        <AlertDescription className="flex items-start justify-between gap-4">
          You can enable the new insights feature for the survey to get AI-based insights for your open-text
          responses.
        </AlertDescription>
      </div>
      <Button
        variant="primary"
        size="sm"
        className="shrink-0"
        onClick={handleInsightGeneration}
        loading={isGeneratingInsights}
        disabled={surveyResponseCount > maxResponseCount || isGeneratingInsights}
        tooltip={
          surveyResponseCount > maxResponseCount
            ? "Kindly contact us at hola@formbricks.com to generate insights for this survey"
            : undefined
        }>
        Enable insights
      </Button>
    </Alert>
  );
};
