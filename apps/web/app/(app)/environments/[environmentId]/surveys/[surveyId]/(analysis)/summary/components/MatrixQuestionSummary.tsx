"use client";

import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useTranslate } from "@tolgee/react";
import {
  TI18nString,
  TSurvey,
  TSurveyQuestionId,
  TSurveyQuestionSummaryMatrix,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { QuestionSummaryHeader } from "./QuestionSummaryHeader";

interface MatrixQuestionSummaryProps {
  questionSummary: TSurveyQuestionSummaryMatrix;
  survey: TSurvey;
  setFilter: (
    questionId: TSurveyQuestionId,
    label: TI18nString,
    questionType: TSurveyQuestionTypeEnum,
    filterValue: string,
    filterComboBoxValue?: string | string[]
  ) => void;
}

export const MatrixQuestionSummary = ({ questionSummary, survey, setFilter }: MatrixQuestionSummaryProps) => {
  const { t } = useTranslate();
  const getOpacityLevel = (percentage: number): string => {
    const parsedPercentage = percentage;
    const opacity = parsedPercentage * 0.75 + 15;
    return (opacity / 100).toFixed(2);
  };

  const getTooltipContent = (label?: string, percentage?: number, totalResponsesForRow?: number): string => {
    if (label) {
      return label;
    } else if (percentage !== undefined && totalResponsesForRow !== undefined) {
      return `${Math.round((percentage / 100) * totalResponsesForRow)} ${t("common.responses")}`;
    }
    return "";
  };

  const columns = questionSummary.data[0]
    ? questionSummary.data[0].columnPercentages.map((c) => c.column)
    : [];

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <QuestionSummaryHeader questionSummary={questionSummary} survey={survey} />
      <div className="overflow-x-auto p-6">
        {/* Summary Table  */}
        <table className="mx-auto border-collapse cursor-default text-left">
          <thead>
            <tr>
              <th className="p-4 pb-3 pt-0 font-medium text-slate-400 dark:border-slate-600 dark:text-slate-200"></th>
              {columns.map((column) => (
                <th key={column} className="text-center font-medium">
                  <TooltipRenderer tooltipContent={getTooltipContent(column)} shouldRender={true}>
                    <p className="max-w-40 overflow-hidden text-ellipsis whitespace-nowrap">{column}</p>
                  </TooltipRenderer>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {questionSummary.data.map(({ rowLabel, columnPercentages }, rowIndex) => (
              <tr key={rowLabel}>
                <td className="max-w-60 overflow-hidden text-ellipsis whitespace-nowrap p-4">
                  <TooltipRenderer tooltipContent={getTooltipContent(rowLabel)} shouldRender={true}>
                    <p className="max-w-40 overflow-hidden text-ellipsis whitespace-nowrap">{rowLabel}</p>
                  </TooltipRenderer>
                </td>
                {columnPercentages.map(({ column, percentage }) => (
                  <td
                    key={column}
                    className="text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <TooltipRenderer
                      shouldRender={true}
                      tooltipContent={getTooltipContent(
                        undefined,
                        percentage,
                        questionSummary.data[rowIndex].totalResponsesForRow
                      )}>
                      <button
                        style={{ backgroundColor: `rgba(0,196,184,${getOpacityLevel(percentage)})` }}
                        className="hover:outline-brand-dark m-1 flex h-full w-40 cursor-pointer items-center justify-center rounded p-4 text-sm text-slate-950 hover:outline"
                        onClick={() =>
                          setFilter(
                            questionSummary.question.id,
                            questionSummary.question.headline,
                            questionSummary.question.type,
                            rowLabel,
                            column
                          )
                        }>
                        {percentage}
                      </button>
                    </TooltipRenderer>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
