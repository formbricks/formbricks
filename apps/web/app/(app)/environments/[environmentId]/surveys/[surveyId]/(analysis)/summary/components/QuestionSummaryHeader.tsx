"use client";

import { recallToHeadline } from "@/lib/utils/recall";
import { formatTextWithSlashes } from "@/modules/survey/editor/lib/utils";
import { getQuestionTypes } from "@/modules/survey/lib/questions";
import { SettingsId } from "@/modules/ui/components/settings-id";
import { useTranslate } from "@tolgee/react";
import { InboxIcon } from "lucide-react";
import type { JSX } from "react";
import { TSurvey, TSurveyQuestionSummary } from "@formbricks/types/surveys/types";

interface HeadProps {
  questionSummary: TSurveyQuestionSummary;
  showResponses?: boolean;
  additionalInfo?: JSX.Element;
  survey: TSurvey;
}

export const QuestionSummaryHeader = ({
  questionSummary,
  additionalInfo,
  showResponses = true,
  survey,
}: HeadProps) => {
  const { t } = useTranslate();
  const questionType = getQuestionTypes(t).find((type) => type.id === questionSummary.question.type);

  return (
    <div className="space-y-2 px-4 pt-6 pb-5 md:px-6">
      <div className={"align-center flex justify-between gap-4"}>
        <h3 className="pb-1 text-lg font-semibold text-slate-900 md:text-xl">
          {formatTextWithSlashes(
            recallToHeadline(questionSummary.question.headline, survey, true, "default")["default"],
            "@",
            ["text-lg"]
          )}
        </h3>
      </div>
      <div className="flex space-x-2 text-xs font-semibold text-slate-600 md:text-sm">
        <div className="flex items-center rounded-lg bg-slate-100 p-2">
          {questionType && <questionType.icon className="mr-2 h-4 w-4" />}
          {questionType ? questionType.label : t("environments.surveys.summary.unknown_question_type")}{" "}
          {t("common.question")}
        </div>
        {showResponses && (
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            <InboxIcon className="mr-2 h-4 w-4" />
            {`${questionSummary.responseCount} ${t("common.responses")}`}
          </div>
        )}
        {additionalInfo}
        {!questionSummary.question.required && (
          <div className="flex items-center rounded-lg bg-slate-100 p-2">
            {t("environments.surveys.edit.optional")}
          </div>
        )}
      </div>
      <SettingsId title={t("common.question_id")} id={questionSummary.question.id}></SettingsId>
    </div>
  );
};
