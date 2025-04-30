"use client";

import { cn } from "@/lib/cn";
import { createI18nString } from "@/lib/i18n/utils";
import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslate } from "@tolgee/react";
import { GripVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import {
  TI18nString,
  TSurvey,
  TSurveyLanguage,
  TSurveyMultipleChoiceQuestion,
  TSurveyQuestionChoice,
  TSurveyRankingQuestion,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { isLabelValidForAllLanguages } from "../lib/validation";

interface ChoiceProps {
  choice: TSurveyQuestionChoice;
  choiceIdx: number;
  questionIdx: number;
  updateChoice: (choiceIdx: number, updatedAttributes: { label: TI18nString }) => void;
  deleteChoice: (choiceIdx: number) => void;
  addChoice: (choiceIdx: number) => void;
  isInvalid: boolean;
  localSurvey: TSurvey;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  surveyLanguages: TSurveyLanguage[];
  question: TSurveyMultipleChoiceQuestion | TSurveyRankingQuestion;
  updateQuestion: (
    questionIdx: number,
    updatedAttributes: Partial<TSurveyMultipleChoiceQuestion> | Partial<TSurveyRankingQuestion>
  ) => void;
  surveyLanguageCodes: string[];
  locale: TUserLocale;
}

export const QuestionOptionChoice = ({
  addChoice,
  choice,
  choiceIdx,
  deleteChoice,
  isInvalid,
  localSurvey,
  questionIdx,
  selectedLanguageCode,
  setSelectedLanguageCode,
  surveyLanguages,
  updateChoice,
  question,
  surveyLanguageCodes,
  updateQuestion,
  locale,
}: ChoiceProps) => {
  // [UseTusk]

  const { t } = useTranslate();
  const isDragDisabled = choice.id === "other";
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: choice.id,
    disabled: isDragDisabled,
  });

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div className="flex w-full items-center gap-2" ref={setNodeRef} style={style}>
      {/* drag handle */}
      <div className={cn(choice.id === "other" && "invisible")} {...listeners} {...attributes}>
        <GripVerticalIcon className="h-4 w-4 cursor-move text-slate-400" />
      </div>

      <div className="flex w-full space-x-2">
        <QuestionFormInput
          key={choice.id}
          id={`choice-${choiceIdx}`}
          placeholder={
            choice.id === "other"
              ? t("common.other")
              : t("environments.surveys.edit.option_idx", { choiceIndex: choiceIdx + 1 })
          }
          label={""}
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          value={choice.label}
          updateChoice={updateChoice}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          isInvalid={
            isInvalid && !isLabelValidForAllLanguages(question.choices[choiceIdx].label, surveyLanguages)
          }
          className={`${choice.id === "other" ? "border border-dashed" : ""} mt-0`}
          locale={locale}
        />
        {choice.id === "other" && (
          <QuestionFormInput
            id="otherOptionPlaceholder"
            localSurvey={localSurvey}
            placeholder={t("environments.surveys.edit.please_specify")}
            label={""}
            questionIdx={questionIdx}
            value={
              question.otherOptionPlaceholder
                ? question.otherOptionPlaceholder
                : createI18nString(t("environments.surveys.edit.please_specify"), surveyLanguageCodes)
            }
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={
              isInvalid && !isLabelValidForAllLanguages(question.choices[choiceIdx].label, surveyLanguages)
            }
            className="border border-dashed"
            locale={locale}
          />
        )}
      </div>
      <div className="flex gap-2">
        {question.choices && question.choices.length > 2 && (
          <TooltipRenderer tooltipContent={t("environments.surveys.edit.delete_choice")}>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Delete choice"
              onClick={(e) => {
                e.preventDefault();
                deleteChoice(choiceIdx);
              }}>
              <TrashIcon />
            </Button>
          </TooltipRenderer>
        )}
        {choice.id !== "other" && (
          <TooltipRenderer tooltipContent={t("environments.surveys.edit.add_choice_below")}>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Add choice below"
              onClick={(e) => {
                e.preventDefault();
                addChoice(choiceIdx);
              }}>
              <PlusIcon />
            </Button>
          </TooltipRenderer>
        )}
      </div>
    </div>
  );
};
