"use client";

import { cn } from "@/lib/cn";
import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslate } from "@tolgee/react";
import { GripVerticalIcon, TrashIcon } from "lucide-react";
import {
  TI18nString,
  TSurvey,
  TSurveyLanguage,
  TSurveyMatrixQuestion,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { isLabelValidForAllLanguages } from "../lib/validation";

interface MatrixLabelChoiceProps {
  labelIdx: number;
  type: "row" | "column";
  questionIdx: number;
  updateMatrixLabel: (index: number, type: "row" | "column", data: TI18nString) => void;
  handleDeleteLabel: (type: "row" | "column", index: number) => void;
  handleKeyDown: (e: React.KeyboardEvent, type: "row" | "column") => void;
  isInvalid: boolean;
  localSurvey: TSurvey;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  question: TSurveyMatrixQuestion;
  locale: TUserLocale;
}

export const MatrixLabelChoice = ({
  labelIdx,
  type,
  questionIdx,
  updateMatrixLabel,
  handleDeleteLabel,
  handleKeyDown,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  question,
  locale,
}: MatrixLabelChoiceProps) => {
  const { t } = useTranslate();
  const labels = type === "row" ? question.rows : question.columns;
  const surveyLanguages = localSurvey.languages ?? [];

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `${type}-${labelIdx}`,
  });

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div className="flex w-full items-center gap-2" ref={setNodeRef} style={style}>
      {/* drag handle */}
      <div {...listeners} {...attributes}>
        <GripVerticalIcon className="h-4 w-4 cursor-move text-slate-400" />
      </div>

      <div className="flex w-full space-x-2">
        <QuestionFormInput
          key={`${type}-${labelIdx}`}
          id={`${type}-${labelIdx}`}
          placeholder={t(`environments.surveys.edit.${type}_idx`, {
            [`${type}Index`]: labelIdx + 1,
          })}
          label=""
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          value={labels[labelIdx]}
          updateMatrixLabel={updateMatrixLabel}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          isInvalid={isInvalid && !isLabelValidForAllLanguages(labels[labelIdx], surveyLanguages)}
          onKeyDown={(e) => handleKeyDown(e, type)}
          locale={locale}
        />
      </div>

      <div className="flex gap-2">
        {labels.length > 2 && (
          <TooltipRenderer tooltipContent={t(`environments.surveys.edit.delete_${type}`)}>
            <Button
              variant="secondary"
              size="icon"
              aria-label={`Delete ${type}`}
              onClick={(e) => {
                e.preventDefault();
                handleDeleteLabel(type, labelIdx);
              }}>
              <TrashIcon />
            </Button>
          </TooltipRenderer>
        )}
      </div>
    </div>
  );
};
