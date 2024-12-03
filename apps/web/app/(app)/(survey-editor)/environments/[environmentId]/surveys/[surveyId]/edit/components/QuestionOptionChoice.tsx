import { QuestionFormInput } from "@/modules/surveys/components/QuestionFormInput";
import { Button } from "@/modules/ui/components/button";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon, PlusIcon, TrashIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@formbricks/lib/cn";
import { createI18nString } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
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
  attributeClasses: TAttributeClass[];
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
  attributeClasses,
  locale,
}: ChoiceProps) => {
  const t = useTranslations();
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
          attributeClasses={attributeClasses}
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
            attributeClasses={attributeClasses}
            locale={locale}
          />
        )}
      </div>
      <div className="flex gap-2">
        {question.choices && question.choices.length > 2 && (
          <Button
            variant="secondary"
            size="icon"
            icon={TrashIcon}
            iconPlacement="start"
            tooltip="Delete choice"
            aria-label="Delete choice"
            onClick={(e) => {
              e.preventDefault();
              deleteChoice(choiceIdx);
            }}
          />
        )}
        {choice.id !== "other" && (
          <Button
            variant="secondary"
            size="icon"
            icon={PlusIcon}
            iconPlacement="start"
            tooltip="Add choice below"
            aria-label="Add choice below"
            onClick={(e) => {
              e.preventDefault();
              addChoice(choiceIdx);
            }}
          />
        )}
      </div>
    </div>
  );
};
