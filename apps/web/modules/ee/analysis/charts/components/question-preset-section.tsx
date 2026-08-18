"use client";

import { ListChecksIcon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useTranslation } from "react-i18next";
import { getFormattedErrorMessage } from "@/lib/utils/helper";
import { executeQueryAction, getDirectoryQuestionsAction } from "@/modules/ee/analysis/charts/actions";
import { buildQuestionChartQuery } from "@/modules/ee/analysis/charts/lib/build-question-chart-query";
import type { AnalyticsResponse } from "@/modules/ee/analysis/types/analysis";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface QuestionPresetSectionProps {
  workspaceId: string;
  feedbackDirectoryId: string;
  onChartGenerated: (data: AnalyticsResponse) => void;
}

interface QuestionOption {
  fieldLabel: string;
  fieldType: string;
}

export function QuestionPresetSection({
  workspaceId,
  feedbackDirectoryId,
  onChartGenerated,
}: Readonly<QuestionPresetSectionProps>) {
  const { t } = useTranslation();

  const [questions, setQuestions] = useState<QuestionOption[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<string | null>(null);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Load the directory's questions whenever the selected data source changes. These are
  // distinct FeedbackRecords.fieldLabel values, so only questions with records appear.
  useEffect(() => {
    let cancelled = false;
    setQuestions([]);
    setSelectedQuestion(null);
    setIsLoadingQuestions(true);

    getDirectoryQuestionsAction({ workspaceId, feedbackDirectoryId })
      .then((result) => {
        if (cancelled) return;
        if (result?.data) {
          setQuestions(result.data);
        } else {
          toast.error(
            getFormattedErrorMessage(result) || t("workspace.analysis.charts.question_preset_failed")
          );
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingQuestions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [workspaceId, feedbackDirectoryId, t]);

  const handleQuestionChange = useCallback(
    async (fieldLabel: string) => {
      const question = questions.find((q) => q.fieldLabel === fieldLabel);
      if (!question) return;

      setSelectedQuestion(fieldLabel);
      setIsGenerating(true);
      try {
        const { query, chartType } = buildQuestionChartQuery({
          fieldLabel: question.fieldLabel,
          fieldType: question.fieldType,
        });

        const result = await executeQueryAction({ workspaceId, query, feedbackDirectoryId });
        if (!result?.data) {
          toast.error(
            getFormattedErrorMessage(result) || t("workspace.analysis.charts.question_preset_failed")
          );
          return;
        }

        onChartGenerated({
          query,
          chartType,
          data: Array.isArray(result.data) ? result.data : [],
          suggestedName: question.fieldLabel,
        });
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : t("common.something_went_wrong_please_try_again");
        toast.error(message);
      } finally {
        setIsGenerating(false);
      }
    },
    [questions, workspaceId, feedbackDirectoryId, onChartGenerated, t]
  );

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 bg-white p-6 shadow-xs">
      <div className="flex flex-col items-center gap-2 text-center">
        <div className="flex size-8 items-center justify-center rounded-full bg-brand-dark/10">
          <ListChecksIcon className="size-5 text-brand-dark" />
        </div>
        <h2 className="font-semibold text-gray-900">
          {t("workspace.analysis.charts.question_preset_title")}
        </h2>
        <p className="text-sm text-gray-500">{t("workspace.analysis.charts.question_preset_description")}</p>
      </div>

      <div className="flex flex-col gap-3">
        <Select
          value={selectedQuestion ?? undefined}
          onValueChange={handleQuestionChange}
          disabled={isLoadingQuestions || isGenerating || questions.length === 0}>
          <SelectTrigger>
            <SelectValue
              placeholder={
                isLoadingQuestions
                  ? t("common.loading")
                  : t("workspace.analysis.charts.question_preset_question_placeholder")
              }
            />
          </SelectTrigger>
          <SelectContent>
            {questions.map((question) => (
              <SelectItem key={question.fieldLabel} value={question.fieldLabel}>
                {question.fieldLabel}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!isLoadingQuestions && questions.length === 0 && (
          <p className="text-sm text-gray-500">
            {t("workspace.analysis.charts.question_preset_no_questions")}
          </p>
        )}
      </div>
    </div>
  );
}
