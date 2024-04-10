import { questionTypes } from "@/app/lib/questions";
import { InboxIcon } from "lucide-react";

import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TSurveySummaryMatrix } from "@formbricks/types/responses";
import { TooltipRenderer } from "@formbricks/ui/Tooltip";

import { Headline } from "./Headline";

interface MatrixQuestionSummaryProps {
  questionSummary: TSurveySummaryMatrix;
}

export const MatrixQuestionSummary = ({ questionSummary }: MatrixQuestionSummaryProps) => {
  const questionTypeInfo = questionTypes.find((type) => type.id === questionSummary.question.type);

  const getOpacityLevel = (percentage: number): string => {
    const parsedPercentage = percentage;
    const opacity = parsedPercentage * 0.75 + 15;
    return (opacity / 100).toFixed(2);
  };

  const getTooltipContent = (label?: string, percentage?: number, totalResponsesForRow?: number): string => {
    if (label) {
      return label;
    } else if (percentage !== undefined && totalResponsesForRow !== undefined) {
      return `${Math.round((percentage / 100) * totalResponsesForRow)} responses`;
    }
    return "";
  };

  const columns = questionSummary.data[0] ? Object.keys(questionSummary.data[0].columnPercentages) : [];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
        <Headline headline={getLocalizedValue(questionSummary.question.headline, "default")} />
        <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
          <div className="flex items-center rounded-lg bg-slate-100 p-2 ">
            {questionTypeInfo && <questionTypeInfo.icon className="mr-2 h-4 w-4 " />}
            {questionTypeInfo ? questionTypeInfo.label : "Unknown Question Type"} Question
          </div>
          <div className=" flex items-center rounded-lg bg-slate-100 p-2">
            <InboxIcon className="mr-2 h-4 w-4" />
            {questionSummary.responseCount} Responses
          </div>
          {!questionSummary.question.required && (
            <div className="flex items-center  rounded-lg bg-slate-100 p-2">Optional</div>
          )}
        </div>
      </div>
      <div className="overflow-x-auto rounded-b-lg bg-white p-6">
        {/* Summary Table  */}
        <table className="mx-auto border-collapse cursor-default text-left">
          <thead>
            <tr>
              <th className="p-4 pb-3 pt-0 font-medium text-slate-400 dark:border-slate-600 dark:text-slate-200"></th>
              {columns.map((column) => (
                <th key={column} className="text-center font-medium ">
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
                <td className=" max-w-60 overflow-hidden text-ellipsis whitespace-nowrap p-4">
                  <TooltipRenderer tooltipContent={getTooltipContent(rowLabel)} shouldRender={true}>
                    <p className="max-w-40 overflow-hidden text-ellipsis whitespace-nowrap">{rowLabel}</p>
                  </TooltipRenderer>
                </td>
                {Object.entries(columnPercentages).map(([column, percentage]) => (
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
                      <div
                        style={{ backgroundColor: `rgba(0,196,184,${getOpacityLevel(percentage)})` }}
                        className=" hover:outline-brand-dark m-1 flex h-full w-40 cursor-default items-center justify-center rounded p-4 text-sm text-slate-950 hover:outline">
                        {percentage}
                      </div>
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
