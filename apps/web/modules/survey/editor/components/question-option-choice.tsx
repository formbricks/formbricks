"use client";

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
import { cn } from "@/lib/cn";
import { createI18nString } from "@/lib/i18n/utils";
import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
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
  isStorageConfigured: boolean;
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
  isStorageConfigured,
}: ChoiceProps) => {
  const { t } = useTranslate();
  const isSpecialChoice = choice.id === "other" || choice.id === "none";
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: choice.id,
    disabled: isSpecialChoice,
  });

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
  };

  const focusChoiceInput = (targetIdx: number) => {
    const input = document.querySelector(`input[id="choice-${targetIdx}"]`) as HTMLInputElement;
    input?.focus();
  };

  const addChoiceAndFocus = (idx: number) => {
    addChoice(idx);
    // Wait for DOM update before focusing the new input
    setTimeout(() => focusChoiceInput(idx + 1), 0);
  };

  const getPlaceholder = () => {
    if (choice.id === "other") return t("common.other");
    if (choice.id === "none") return t("common.none_of_the_above");
    return t("environments.surveys.edit.option_idx", { choiceIndex: choiceIdx + 1 });
  };

  const normalChoice = question.choices?.filter((c) => c.id !== "other" && c.id !== "none") || [];

  return (
    <div className="flex w-full items-center gap-2" ref={setNodeRef} style={style}>
      {/* drag handle */}
      <div className={cn(isSpecialChoice && "invisible")} {...listeners} {...attributes}>
        <GripVerticalIcon className="h-4 w-4 cursor-move text-slate-400" />
      </div>

      <div className="flex w-full space-x-2">
        <QuestionFormInput
          key={choice.id}
          id={`choice-${choiceIdx}`}
          placeholder={getPlaceholder()}
          label={""}
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          value={choice.label}
          updateChoice={updateChoice}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          isInvalid={
            isInvalid && !isLabelValidForAllLanguages(question.choices?.[choiceIdx]?.label, surveyLanguages)
          }
          className={`${isSpecialChoice ? "border border-dashed" : ""} mt-0`}
          locale={locale}
          isStorageConfigured={isStorageConfigured}
          onKeyDown={(e) => {
            if (e.key === "Enter" && choice.id !== "other") {
              e.preventDefault();
              const lastChoiceIdx = question.choices?.findLastIndex((c) => c.id !== "other") ?? -1;

              if (choiceIdx === lastChoiceIdx) {
                addChoiceAndFocus(choiceIdx);
              } else {
                focusChoiceInput(choiceIdx + 1);
              }
            }

            if (e.key === "ArrowDown") {
              e.preventDefault();
              if (choiceIdx + 1 < (question.choices?.length ?? 0)) {
                focusChoiceInput(choiceIdx + 1);
              }
            }

            if (e.key === "ArrowUp") {
              e.preventDefault();
              if (choiceIdx > 0) {
                focusChoiceInput(choiceIdx - 1);
              }
            }
          }}
        />
        {choice.id === "other" && (
          <QuestionFormInput
            id="otherOptionPlaceholder"
            localSurvey={localSurvey}
            placeholder={t("environments.surveys.edit.please_specify")}
            label={""}
            questionIdx={questionIdx}
            value={
              question.otherOptionPlaceholder ??
              createI18nString(t("environments.surveys.edit.please_specify"), surveyLanguageCodes)
            }
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            isInvalid={
              isInvalid && !isLabelValidForAllLanguages(question.choices?.[choiceIdx]?.label, surveyLanguages)
            }
            className="border border-dashed"
            locale={locale}
            isStorageConfigured={isStorageConfigured}
          />
        )}
      </div>
      <div className="flex gap-2">
        {(normalChoice.length > 2 || isSpecialChoice) && (
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
        {!isSpecialChoice && (
          <TooltipRenderer tooltipContent={t("environments.surveys.edit.add_choice_below")}>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Add choice below"
              onClick={(e) => {
                e.preventDefault();
                addChoiceAndFocus(choiceIdx);
              }}>
              <PlusIcon />
            </Button>
          </TooltipRenderer>
        )}
      </div>
    </div>
  );
};
