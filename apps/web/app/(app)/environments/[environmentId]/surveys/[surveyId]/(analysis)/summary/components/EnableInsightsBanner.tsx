"use client";

import { generateInsightsForSurveyAction } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/actions";
import { SparklesIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";
import { Alert, AlertDescription, AlertTitle } from "@formbricks/ui/components/Alert";
import { Button } from "@formbricks/ui/components/Button";

interface EnableInsightsBannerProps {
  surveyId: string;
  surveyResponseCount: number;
}

export const EnableInsightsBanner = ({ surveyId, surveyResponseCount }: EnableInsightsBannerProps) => {
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  const handleInsightGeneration = async () => {
    setIsGeneratingInsights(true);
    const insightGenerationActionResponse = await generateInsightsForSurveyAction({ surveyId });

    if (insightGenerationActionResponse?.data) {
      toast.success("Insights have been generated.");
    } else {
      toast.error("No insights found");
    }

    setIsGeneratingInsights(false);
  };

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
          loading={isGeneratingInsights}
          disabled={surveyResponseCount > 10000}
          tooltip={
            surveyResponseCount > 10000
              ? "Kindly contact us at hola@formbricks.com to generate insights for this survey"
              : undefined
          }>
          Enable Insights
        </Button>
      </AlertDescription>
    </Alert>
  );
};
