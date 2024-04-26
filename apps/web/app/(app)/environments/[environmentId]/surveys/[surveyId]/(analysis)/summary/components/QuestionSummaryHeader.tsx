import { questionTypes } from "@/app/lib/questions";
import { InboxIcon } from "lucide-react";

import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TSurveyQuestionSummary } from "@formbricks/types/surveys";

interface HeadProps {
  questionSummary: TSurveyQuestionSummary;
  showResponses?: boolean;
  insights?: JSX.Element;
}

export const QuestionSummaryHeader = ({ questionSummary, insights, showResponses = true }: HeadProps) => {
  const questionType = questionTypes.find((type) => type.id === questionSummary.question.type);

  return (
    <div className="space-y-2 px-4 pb-5 pt-6 md:px-6">
      <div className={"align-center flex justify-between gap-4 "}>
        <h3 className="pb-1 text-lg font-semibold text-slate-900 md:text-xl">
          {getLocalizedValue(questionSummary.question.headline, "default")}
        </h3>
      </div>
      <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
        <div className="flex items-center rounded-lg bg-slate-100 p-2 ">
          {questionType && <questionType.icon className="mr-2 h-4 w-4 " />}
          {questionType ? questionType.label : "Unknown Question Type"} Question
        </div>
        {showResponses && (
          <div className=" flex items-center rounded-lg bg-slate-100 p-2">
            <InboxIcon className="mr-2 h-4 w-4" />
            {`${questionSummary.responseCount} Responses`}
          </div>
        )}
        {insights}
        {!questionSummary.question.required && (
          <div className="flex items-center  rounded-lg bg-slate-100 p-2">Optional</div>
        )}
      </div>
    </div>
  );
};
