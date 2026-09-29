"use client";

import { useQuery } from "@tanstack/react-query";
import { Grid3x3Icon } from "lucide-react";
import { useId } from "react";
import { useTranslation } from "react-i18next";
import { fetchMatrixQuestions } from "@/modules/ee/analysis/charts/lib/matrix-questions-client";
import { Label } from "@/modules/ui/components/label";
import { LoadingSpinner } from "@/modules/ui/components/loading-spinner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";

interface MatrixQuestionPickerProps {
  workspaceId: string;
  feedbackDirectoryId: string;
  /** The question the chart is currently built from, when its query is the matrix recipe. */
  selectedLabel: string | null;
  onSelect: (label: string) => void;
}

/**
 * The shortcut into a matrix chart: pick the matrix question and the rows, columns and measure are
 * filled in for you (see `buildMatrixQuestionQuery`). Everything it sets stays editable in the panels
 * below, so it is a starting point rather than a separate mode.
 */
export function MatrixQuestionPicker({
  workspaceId,
  feedbackDirectoryId,
  selectedLabel,
  onSelect,
}: Readonly<MatrixQuestionPickerProps>) {
  const { t } = useTranslation();
  const triggerId = useId();

  const {
    data: questions = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["matrixQuestions", workspaceId, feedbackDirectoryId],
    queryFn: ({ signal }) => fetchMatrixQuestions({ workspaceId, feedbackDirectoryId, signal }),
    staleTime: 1000 * 60 * 5,
  });

  const renderControl = () => {
    if (isLoading) {
      return (
        <div className="flex h-9 items-center">
          <LoadingSpinner className="size-4" />
        </div>
      );
    }
    if (isError) {
      return <p className="text-xs text-red-600">{t("workspace.analysis.charts.matrix_questions_error")}</p>;
    }
    if (questions.length === 0) {
      return (
        <p className="text-xs text-slate-500">{t("workspace.analysis.charts.matrix_questions_empty")}</p>
      );
    }
    return (
      <Select value={selectedLabel ?? ""} onValueChange={onSelect}>
        <SelectTrigger id={triggerId} className="bg-white">
          {/* Only the question in the trigger; the statement and scale counts are for choosing. */}
          <SelectValue placeholder={t("workspace.analysis.charts.matrix_question_placeholder")}>
            {selectedLabel ? <span className="truncate">{selectedLabel}</span> : undefined}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {questions.map((question) => (
            <SelectItem key={question.label} value={question.label}>
              <span className="flex flex-col items-start">
                <span className="text-sm text-slate-900">{question.label}</span>
                <span className="text-xs text-slate-500">
                  {t("workspace.analysis.charts.matrix_question_meta", {
                    rows: question.rowCount,
                    columns: question.columnCount,
                    surveys: question.surveyNames.join(", "),
                  })}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className="space-y-2 rounded-lg border border-brand-dark/30 bg-brand-dark/5 p-3">
      <div className="flex items-center gap-2">
        <Grid3x3Icon className="size-4 text-brand-dark" aria-hidden="true" />
        <Label htmlFor={triggerId} className="text-sm font-medium text-slate-900">
          {t("workspace.analysis.charts.matrix_question_label")}
        </Label>
      </div>
      <p className="text-xs text-slate-600">{t("workspace.analysis.charts.matrix_question_description")}</p>
      {renderControl()}
    </div>
  );
}
