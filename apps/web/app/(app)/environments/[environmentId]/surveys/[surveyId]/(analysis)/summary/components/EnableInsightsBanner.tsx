"use client";

import { generateInsightsForSurveyAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { SparklesIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Alert, AlertDescription, AlertTitle } from "@formbricks/ui/components/Alert";
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
    toast.success("Generating insights for this survey. Please check back in a few minutes.", {
      duration: 3000,
    });
    setIsGeneratingInsights(true);
    generateInsightsForSurveyAction({ surveyId });
  };

  if (isGeneratingInsights) {
    return null;
  }

  return (
    <Alert className="w-1/2 bg-white">
      <SparklesIcon className="h-4 w-4" />
      <AlertTitle>
        <span>Ready to enable insights?</span>
      </AlertTitle>
      <AlertDescription className="flex items-start justify-between gap-4">
        <span>
          You can enable the new insights feature for the survey to get AI-based insights for your open-text
          responses.
        </span>
        <Button
          variant="secondary"
          size="sm"
          className="shrink-0"
          onClick={handleInsightGeneration}
          disabled={surveyResponseCount > maxResponseCount}
          tooltip={
            surveyResponseCount > maxResponseCount
              ? "Kindly contact us at hola@formbricks.com to generate insights for this survey"
              : undefined
          }>
          Enable Insights
        </Button>
      </AlertDescription>
    </Alert>
  );
};
