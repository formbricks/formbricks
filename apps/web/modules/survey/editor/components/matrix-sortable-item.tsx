"use client";

import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslate } from "@tolgee/react";
import { GripVerticalIcon, TrashIcon } from "lucide-react";
import type { JSX } from "react";
import {
  TI18nString,
  TSurvey,
  TSurveyMatrixQuestion,
  TSurveyMatrixQuestionChoice,
} from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface MatrixSortableItemProps {
  choice: TSurveyMatrixQuestionChoice;
  type: "row" | "column";
  index: number;
  localSurvey: TSurvey;
  question: TSurveyMatrixQuestion;
  questionIdx: number;
  updateMatrixLabel: (index: number, type: "row" | "column", matrixLabel: TI18nString) => void;
  onDelete: (index: number) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  canDelete: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
}

export const MatrixSortableItem = ({
  choice,
  type,
  index,
  localSurvey,
  questionIdx,
  updateMatrixLabel,
  onDelete,
  onKeyDown,
  canDelete,
  selectedLanguageCode,
  setSelectedLanguageCode,
  isInvalid,
  locale,
}: MatrixSortableItemProps): JSX.Element => {
  const { t } = useTranslate();

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: choice.id,
  });

  const style = {
    transition: transition ?? "transform 100ms ease",
    transform: CSS.Translate.toString(transform),
  };

  return (
    <div className="flex w-full items-center gap-2" ref={setNodeRef} style={style}>
      <div {...listeners} {...attributes}>
        <GripVerticalIcon className="h-4 w-4 cursor-move text-slate-400" />
      </div>

      <div className="flex w-full items-center">
        <QuestionFormInput
          key={choice.id}
          id={`${type}-${index}`}
          label=""
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          value={choice.label}
          updateMatrixLabel={updateMatrixLabel}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          isInvalid={isInvalid}
          locale={locale}
          onKeyDown={onKeyDown}
        />
        {canDelete && (
          <TooltipRenderer data-testid="tooltip-renderer" tooltipContent={t("common.delete")}>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2"
              onClick={(e) => {
                e.preventDefault();
                onDelete(index);
              }}>
              <TrashIcon />
            </Button>
          </TooltipRenderer>
        )}
      </div>
    </div>
  );
};
