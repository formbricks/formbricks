"use client";

import { MatrixLabelChoice } from "@/modules/survey/editor/components/matrix-label-choice";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useTranslate } from "@tolgee/react";
import { PlusIcon } from "lucide-react";
import { TI18nString, TSurvey, TSurveyMatrixQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface MatrixLabelSectionProps {
  type: "row" | "column";
  labels: TI18nString[];
  question: TSurveyMatrixQuestion;
  questionIdx: number;
  updateMatrixLabel: (index: number, type: "row" | "column", data: TI18nString) => void;
  handleDeleteLabel: (type: "row" | "column", index: number) => void;
  handleKeyDown: (e: React.KeyboardEvent, type: "row" | "column") => void;
  handleAddLabel: (type: "row" | "column") => void;
  onDragEnd: (event: any) => void;
  isInvalid: boolean;
  localSurvey: TSurvey;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  locale: TUserLocale;
  parent: any;
}

export const MatrixLabelSection = ({
  type,
  labels,
  question,
  questionIdx,
  updateMatrixLabel,
  handleDeleteLabel,
  handleKeyDown,
  handleAddLabel,
  onDragEnd,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  locale,
  parent,
}: MatrixLabelSectionProps) => {
  const { t } = useTranslate();
  const labelKey = type === "row" ? "rows" : "columns";
  const addKey = type === "row" ? "add_row" : "add_column";

  return (
    <div>
      <Label htmlFor={labelKey}>{t(`environments.surveys.edit.${labelKey}`)}</Label>
      <div className="mt-2" id={labelKey}>
        <DndContext id={`matrix-${labelKey}`} onDragEnd={onDragEnd}>
          <SortableContext
            items={labels.map((_, idx) => `${type}-${idx}`)}
            strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2" ref={parent}>
              {labels.map((_, index) => (
                <MatrixLabelChoice
                  key={`${type}-${index}`}
                  labelIdx={index}
                  type={type}
                  questionIdx={questionIdx}
                  updateMatrixLabel={updateMatrixLabel}
                  handleDeleteLabel={handleDeleteLabel}
                  handleKeyDown={handleKeyDown}
                  isInvalid={isInvalid}
                  localSurvey={localSurvey}
                  selectedLanguageCode={selectedLanguageCode}
                  setSelectedLanguageCode={setSelectedLanguageCode}
                  question={question}
                  locale={locale}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2 w-fit"
          onClick={(e) => {
            e.preventDefault();
            handleAddLabel(type);
          }}>
          <PlusIcon />
          {t(`environments.surveys.edit.${addKey}`)}
        </Button>
      </div>
    </div>
  );
};
