import Headline from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/(analysis)/summary/components/Headline";
import { questionTypes } from "@/app/lib/questions";
import { InboxIcon } from "lucide-react";
import { useMemo } from "react";

import { TSurveySummaryMatrix } from "@formbricks/types/responses";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@formbricks/ui/Tooltip";

interface MatrixQuestionSummaryProps {
  questionSummary: TSurveySummaryMatrix;
}

export const MatrixQuestionSummary = ({ questionSummary }: MatrixQuestionSummaryProps) => {
  const questionTypeInfo = questionTypes.find((type) => type.id === questionSummary.question.type);

  const getAlphaValue = (percentage: number) => {
    const parsedPercentage = percentage;
    const opacity = parsedPercentage * 0.75 + 25;
    return (opacity / 100).toFixed(2);
  };

  const columns = questionSummary.data[0] ? Object.keys(questionSummary.data[0].columnPercentages) : [];

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 shadow-sm">
      <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
        <Headline headline={questionSummary.question.headline} />
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
        <table className="mx-auto border-collapse text-left">
          <thead>
            <tr>
              <th className="p-4 pb-3 pt-0 font-medium text-slate-400 dark:border-slate-600 dark:text-slate-200"></th>
              {columns.map((column) => (
                <th key={column} className="text-center font-medium ">
                  <ToolTip label={column}>
                    <p className="max-w-40 overflow-hidden text-ellipsis whitespace-nowrap">{column}</p>
                  </ToolTip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {questionSummary.data.map(({ rowLabel, columnPercentages }) => (
              <tr key={rowLabel}>
                <td className=" max-w-60 overflow-hidden text-ellipsis whitespace-nowrap p-4">
                  <ToolTip label={rowLabel}>
                    <p className="max-w-40 overflow-hidden text-ellipsis whitespace-nowrap">{rowLabel}</p>
                  </ToolTip>
                </td>
                {Object.entries(columnPercentages).map(([column, percentage]) => (
                  <td
                    key={column}
                    className="text-center text-slate-500 dark:border-slate-700 dark:text-slate-400">
                    <ToolTip percentage={percentage} totalResponses={questionSummary.responseCount}>
                      <div
                        style={{ backgroundColor: `rgba(0,196,184,${getAlphaValue(percentage)})` }}
                        className=" hover:outline-brand-dark m-1 flex h-full w-40 items-center justify-center rounded p-4 text-sm hover:outline">
                        {percentage}
                      </div>
                    </ToolTip>
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

interface ToolTipProps {
  children: React.ReactNode;
  percentage?: number;
  totalResponses?: number;
  label?: string;
}

const ToolTip = ({ children, percentage, totalResponses, label }: ToolTipProps) => {
  const tooltipContent = useMemo(() => {
    if (label) {
      return label;
    } else if (percentage !== undefined && totalResponses !== undefined) {
      return `${Math.round((percentage / 100) * totalResponses)} responses`;
    }
  }, [label, percentage, totalResponses]);
  return (
    <TooltipProvider delayDuration={50}>
      <Tooltip>
        <TooltipTrigger>{children}</TooltipTrigger>
        <TooltipContent side={"top"}>
          <p className="py-2 text-center text-xs text-slate-500 dark:text-slate-400">{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
