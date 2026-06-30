"use client";

import { useTranslation } from "react-i18next";
import { UNSUPPORTED_FEEDBACK_SOURCE_ELEMENT_TYPES } from "@formbricks/types/feedback-source";
import { getTSurveyElementTypeEnumName } from "@/modules/survey/lib/elements";
import { Checkbox } from "@/modules/ui/components/checkbox";
import { Label } from "@/modules/ui/components/label";
import { TUnifySurvey } from "../types";

interface FormbricksQuestionListProps {
  survey: TUnifySurvey | null;
  selectedQuestionIds: string[];
  onQuestionToggle: (questionId: string) => void;
}

const isUnsupportedElementType = (type: string): boolean =>
  (UNSUPPORTED_FEEDBACK_SOURCE_ELEMENT_TYPES as readonly string[]).includes(type);

export const FormbricksQuestionList = ({
  survey,
  selectedQuestionIds,
  onQuestionToggle,
}: Readonly<FormbricksQuestionListProps>) => {
  const { t } = useTranslation();

  if (!survey) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-3">
        <p className="text-sm text-slate-500">{t("workspace.unify.select_a_survey_to_see_questions")}</p>
      </div>
    );
  }

  if (survey.elements.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-300 p-3">
        <p className="text-sm text-slate-500">{t("workspace.unify.survey_has_no_questions")}</p>
      </div>
    );
  }

  return (
    <div className="max-h-64 space-y-2 overflow-y-auto rounded-md border border-slate-200 p-3">
      {survey.elements.map((element) => {
        const unsupported = isUnsupportedElementType(element.type);
        const isChecked = selectedQuestionIds.includes(element.id);
        const elementTypeLabel = getTSurveyElementTypeEnumName(element.type, t) ?? element.type;
        const inputId = `feedbackSource-question-${element.id}`;

        return (
          <div
            key={element.id}
            className={`flex items-start gap-3 rounded-md border border-slate-100 p-2 ${
              unsupported ? "opacity-60" : ""
            }`}>
            <Checkbox
              id={inputId}
              checked={!unsupported && isChecked}
              disabled={unsupported}
              onCheckedChange={() => {
                if (!unsupported) {
                  onQuestionToggle(element.id);
                }
              }}
            />
            <div className="space-y-0.5">
              <Label htmlFor={inputId} className={unsupported ? "cursor-not-allowed" : "cursor-pointer"}>
                {element.headline}
              </Label>
              <p className="text-xs text-slate-500">{elementTypeLabel}</p>
              {unsupported && (
                <p className="text-xs text-slate-500">{t("workspace.unify.question_type_not_supported")}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
