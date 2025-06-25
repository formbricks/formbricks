"use client";

import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { MatrixLabelChoice } from "@/modules/survey/editor/components/matrix-label-choice";
import { findOptionUsedInLogic } from "@/modules/survey/editor/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import { ShuffleOptionSelect } from "@/modules/ui/components/shuffle-option-select";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useTranslate } from "@tolgee/react";
import { PlusIcon } from "lucide-react";
import type { JSX } from "react";
import toast from "react-hot-toast";
import { TI18nString, TSurvey, TSurveyMatrixQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";

interface MatrixQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyMatrixQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyMatrixQuestion>) => void;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  locale: TUserLocale;
}

export const MatrixQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  locale,
}: MatrixQuestionFormProps): JSX.Element => {
  const languageCodes = extractLanguageCodes(localSurvey.languages);
  const { t } = useTranslate();
  // Function to add a new Label input field
  const handleAddLabel = (type: "row" | "column") => {
    if (type === "row") {
      const updatedRows = [...question.rows, createI18nString("", languageCodes)];
      updateQuestion(questionIdx, { rows: updatedRows });
    } else {
      const updatedColumns = [...question.columns, createI18nString("", languageCodes)];
      updateQuestion(questionIdx, { columns: updatedColumns });
    }
  };

  // Function to delete a label input field
  const handleDeleteLabel = (type: "row" | "column", index: number) => {
    const labels = type === "row" ? question.rows : question.columns;
    if (labels.length <= 2) return; // Prevent deleting below minimum length

    // check if the label is used in logic
    if (type === "column") {
      const questionIdx = findOptionUsedInLogic(localSurvey, question.id, index.toString());
      if (questionIdx !== -1) {
        toast.error(
          t("environments.surveys.edit.column_used_in_logic_error", {
            questionIndex: questionIdx + 1,
          })
        );
        return;
      }
    } else {
      const questionIdx = findOptionUsedInLogic(localSurvey, question.id, index.toString(), true);
      if (questionIdx !== -1) {
        toast.error(
          t("environments.surveys.edit.row_used_in_logic_error", {
            questionIndex: questionIdx + 1,
          })
        );
        return;
      }
    }

    const updatedLabels = labels.filter((_, idx) => idx !== index);
    if (type === "row") {
      updateQuestion(questionIdx, { rows: updatedLabels });
    } else {
      updateQuestion(questionIdx, { columns: updatedLabels });
    }
  };

  const updateMatrixLabel = (index: number, type: "row" | "column", matrixLabel: TI18nString) => {
    const labels = type === "row" ? [...question.rows] : [...question.columns];

    // Update the label at the given index, or add a new label if index is undefined
    if (index !== undefined) {
      labels[index] = matrixLabel;
    } else {
      labels.push(matrixLabel);
    }
    if (type === "row") {
      updateQuestion(questionIdx, { rows: labels });
    } else {
      updateQuestion(questionIdx, { columns: labels });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: "row" | "column") => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddLabel(type);
    }
  };

  const handleRowDragEnd = (event: any) => {
    const { active, over } = event;

    if (!active || !over) {
      return;
    }

    const activeIndex = question.rows.findIndex((_, idx) => `row-${idx}` === active.id);
    const overIndex = question.rows.findIndex((_, idx) => `row-${idx}` === over.id);

    if (activeIndex !== overIndex) {
      const newRows = [...question.rows];
      const [reorderedItem] = newRows.splice(activeIndex, 1);
      newRows.splice(overIndex, 0, reorderedItem);
      updateQuestion(questionIdx, { rows: newRows });
    }
  };

  const handleColumnDragEnd = (event: any) => {
    const { active, over } = event;

    if (!active || !over) {
      return;
    }

    const activeIndex = question.columns.findIndex((_, idx) => `column-${idx}` === active.id);
    const overIndex = question.columns.findIndex((_, idx) => `column-${idx}` === over.id);

    if (activeIndex !== overIndex) {
      const newColumns = [...question.columns];
      const [reorderedItem] = newColumns.splice(activeIndex, 1);
      newColumns.splice(overIndex, 0, reorderedItem);
      updateQuestion(questionIdx, { columns: newColumns });
    }
  };

  const shuffleOptionsTypes = {
    none: {
      id: "none",
      label: t("environments.surveys.edit.keep_current_order"),
      show: true,
    },
    all: {
      id: "all",
      label: t("environments.surveys.edit.randomize_all"),
      show: true,
    },
    exceptLast: {
      id: "exceptLast",
      label: t("environments.surveys.edit.randomize_all_except_last"),
      show: true,
    },
  };
  /// Auto animate
  const [parent] = useAutoAnimate();
  return (
    <form>
      <QuestionFormInput
        id="headline"
        value={question.headline}
        label={t("environments.surveys.edit.question") + "*"}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        locale={locale}
      />
      <div ref={parent}>
        {question.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="subheader"
                value={question.subheader}
                label={t("common.description")}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                locale={locale}
              />
            </div>
          </div>
        )}
        {question.subheader === undefined && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-3"
            type="button"
            onClick={() => {
              updateQuestion(questionIdx, {
                subheader: createI18nString("", languageCodes),
              });
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            {t("environments.surveys.edit.add_description")}
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          {/* Rows section */}
          <Label htmlFor="rows">{t("environments.surveys.edit.rows")}</Label>
          <div className="mt-2" id="rows">
            <DndContext id="matrix-rows" onDragEnd={handleRowDragEnd}>
              <SortableContext
                items={question.rows.map((_, idx) => `row-${idx}`)}
                strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2" ref={parent}>
                  {question.rows.map((_, index) => (
                    <MatrixLabelChoice
                      key={`row-${index}`}
                      labelIdx={index}
                      type="row"
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
                handleAddLabel("row");
              }}>
              <PlusIcon />
              {t("environments.surveys.edit.add_row")}
            </Button>
          </div>
        </div>
        <div>
          {/* Columns section */}
          <Label htmlFor="columns">{t("environments.surveys.edit.columns")}</Label>
          <div className="mt-2" id="columns">
            <DndContext id="matrix-columns" onDragEnd={handleColumnDragEnd}>
              <SortableContext
                items={question.columns.map((_, idx) => `column-${idx}`)}
                strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2" ref={parent}>
                  {question.columns.map((_, index) => (
                    <MatrixLabelChoice
                      key={`column-${index}`}
                      labelIdx={index}
                      type="column"
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
                handleAddLabel("column");
              }}>
              <PlusIcon />
              {t("environments.surveys.edit.add_column")}
            </Button>
          </div>
          <div className="mt-3 flex flex-1 items-center justify-end gap-2">
            <ShuffleOptionSelect
              shuffleOptionsTypes={shuffleOptionsTypes}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              shuffleOption={question.shuffleOption}
            />
          </div>
        </div>
      </div>
    </form>
  );
};
