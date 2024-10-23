"use client";

import { createAISurveyAction } from "@/app/(app)/(survey-editor)/environments/[environmentId]/surveys/templates/actions";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";
import { getFormattedErrorMessage } from "@formbricks/lib/actionClient/helper";
import { Button } from "@formbricks/ui/components/Button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@formbricks/ui/components/Card";
import { Textarea } from "@formbricks/ui/components/Textarea";

interface FormbricksAICardProps {
  environmentId: string;
}

export const FormbricksAICard = ({ environmentId }: FormbricksAICardProps) => {
  const router = useRouter();
  const [aiPrompt, setAiPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Here you would typically send the data to your backend
    const createSurveyResponse = await createAISurveyAction({
      environmentId,
      prompt: aiPrompt,
    });

    if (createSurveyResponse?.data) {
      router.push(`/environments/${environmentId}/surveys/${createSurveyResponse.data.id}/edit`);
    } else {
      const errorMessage = getFormattedErrorMessage(createSurveyResponse);
      toast.error(errorMessage);
    }
    // Reset form field after submission
    setAiPrompt("");
    setIsLoading(false);
  };

  return (
    <Card className="mx-auto w-full bg-gradient-to-tr from-slate-100 to-slate-200">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Formbricks AI</CardTitle>
        <CardDescription>
          Describe your survey and let Formbricks AI create the survey for you
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            className="bg-slate-50"
            id="ai-prompt"
            placeholder="Enter survey information (e.g. key topics to cover)"
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            required
            aria-label="AI Prompt"
          />
        </form>
      </CardContent>
      <CardFooter>
        <Button
          className="w-full shadow-sm"
          type="submit"
          onClick={handleSubmit}
          variant="secondary"
          loading={isLoading}>
          <Sparkles className="mr-2 h-4 w-4" />
          Generate
        </Button>
      </CardFooter>
    </Card>
  );
};
