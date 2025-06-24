"use client";

import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { Button } from "@/modules/ui/components/button";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useTranslate } from "@tolgee/react";
import { GripVerticalIcon, TrashIcon } from "lucide-react";
import { TI18nString, TSurvey, TSurveyMatrixQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { isLabelValidForAllLanguages } from "../lib/validation";

interface MatrixColumnChoiceProps {
  columnIdx: number;
  questionIdx: number;
  updateMatrixLabel: (index: number, type: "row" | "column", matrixLabel: TI18nString) => void;
  handleDeleteLabel: (type: "row" | "column", index: number) => void;
  handleKeyDown: (e: React.KeyboardEvent, type: "row" | "column") => void;
  isInvalid: boolean;
  localSurvey: TSurvey;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  question: TSurveyMatrixQuestion;
  locale: TUserLocale;
}

export const MatrixColumnChoice = ({
  columnIdx,
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
}: MatrixColumnChoiceProps) => {
  const { t } = useTranslate();
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: `column-${columnIdx}`,
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

      <div className="flex w-full">
        <QuestionFormInput
          id={`column-${columnIdx}`}
          label={""}
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          value={question.columns[columnIdx]}
          updateMatrixLabel={updateMatrixLabel}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          isInvalid={
            isInvalid && !isLabelValidForAllLanguages(question.columns[columnIdx], localSurvey.languages)
          }
          locale={locale}
          onKeyDown={(e) => handleKeyDown(e, "column")}
        />
      </div>

      {question.columns.length > 2 && (
        <TooltipRenderer data-testid="tooltip-renderer" tooltipContent={t("common.delete")}>
          <Button
            variant="ghost"
            size="icon"
            className="ml-2"
            onClick={(e) => {
              e.preventDefault();
              handleDeleteLabel("column", columnIdx);
            }}>
            <TrashIcon />
          </Button>
        </TooltipRenderer>
      )}
    </div>
  );
};
