"use client";

import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { createAISurveyAction } from "@/modules/survey/templates/actions";
import { Button } from "@/modules/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/modules/ui/components/card";
import { Textarea } from "@/modules/ui/components/textarea";
import { useTranslate } from "@tolgee/react";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import toast from "react-hot-toast";

interface FormbricksAICardProps {
  environmentId: string;
}

export const FormbricksAICard = ({ environmentId }: FormbricksAICardProps) => {
  const { t } = useTranslate();
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
        <CardDescription>{t("environments.surveys.edit.formbricks_ai_description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            className="bg-slate-50"
            id="ai-prompt"
            placeholder={t("environments.surveys.edit.formbricks_ai_prompt_placeholder")}
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
          {t("environments.surveys.edit.formbricks_ai_generate")}
        </Button>
      </CardFooter>
    </Card>
  );
};
