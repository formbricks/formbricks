"use client";

import { getLocalizedValue } from "@/lib/i18n/utils";
import { LogicEditorActions } from "@/modules/survey/editor/components/logic-editor-actions";
import { LogicEditorConditions } from "@/modules/survey/editor/components/logic-editor-conditions";
import { getQuestionIconMap } from "@/modules/survey/lib/questions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { useTranslate } from "@tolgee/react";
import { ArrowRightIcon } from "lucide-react";
import { ReactElement, useMemo } from "react";
import { TSurvey, TSurveyLogic, TSurveyQuestion } from "@formbricks/types/surveys/types";

interface LogicEditorProps {
  localSurvey: TSurvey;
  logicItem: TSurveyLogic;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  question: TSurveyQuestion;
  questionIdx: number;
  logicIdx: number;
  isLast: boolean;
}

export function LogicEditor({
  localSurvey,
  logicItem,
  updateQuestion,
  question,
  questionIdx,
  logicIdx,
  isLast,
}: LogicEditorProps) {
  // [UseTusk]

  const { t } = useTranslate();
  const QUESTIONS_ICON_MAP = getQuestionIconMap(t);
  const fallbackOptions = useMemo(() => {
    let options: {
      icon?: ReactElement;
      label: string;
      value: string;
    }[] = [];

    for (let i = questionIdx + 1; i < localSurvey.questions.length; i++) {
      const ques = localSurvey.questions[i];
      options.push({
        icon: QUESTIONS_ICON_MAP[ques.type],
        label: getLocalizedValue(ques.headline, "default"),
        value: ques.id,
      });
    }

    localSurvey.endings.forEach((ending) => {
      options.push({
        label:
          ending.type === "endScreen"
            ? getLocalizedValue(ending.headline, "default") || t("environments.surveys.edit.end_screen_card")
            : ending.label || t("environments.surveys.edit.redirect_thank_you_card"),
        value: ending.id,
      });
    });

    return options;
  }, [localSurvey.questions, localSurvey.endings, question.id, t]);

  return (
    <div className="flex w-full grow flex-col gap-4 overflow-x-auto pb-2 text-sm">
      <LogicEditorConditions
        conditions={logicItem.conditions}
        updateQuestion={updateQuestion}
        question={question}
        questionIdx={questionIdx}
        localSurvey={localSurvey}
        logicIdx={logicIdx}
      />
      <LogicEditorActions
        logicItem={logicItem}
        logicIdx={logicIdx}
        question={question}
        updateQuestion={updateQuestion}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
      />
      {isLast ? (
        <div className="flex items-center space-x-2">
          <ArrowRightIcon className="h-4 w-4" />
          <p className="text-nowrap text-slate-700">
            {t("environments.surveys.edit.all_other_answers_will_continue_to")}
          </p>
          <Select
            autoComplete="true"
            defaultValue={question.logicFallback || "defaultSelection"}
            onValueChange={(val) => {
              updateQuestion(questionIdx, {
                logicFallback: val === "defaultSelection" ? undefined : val,
              });
            }}>
            <SelectTrigger className="w-auto bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key="fallback_default_selection" value={"defaultSelection"}>
                {t("environments.surveys.edit.next_question")}
              </SelectItem>

              {fallbackOptions.map((option) => (
                <SelectItem key={`fallback_${option.value}`} value={option.value}>
                  <div className="flex items-center gap-2">
                    {option.icon}
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}
    </div>
  );
}
