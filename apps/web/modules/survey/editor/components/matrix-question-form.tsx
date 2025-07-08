"use client";

import { createI18nString, extractLanguageCodes } from "@/lib/i18n/utils";
import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { MatrixSortableItem } from "@/modules/survey/editor/components/matrix-sortable-item";
import { findOptionUsedInLogic } from "@/modules/survey/editor/lib/utils";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import { ShuffleOptionSelect } from "@/modules/ui/components/shuffle-option-select";
import { DndContext, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { createId } from "@paralleldrive/cuid2";
import { useTranslate } from "@tolgee/react";
import { PlusIcon } from "lucide-react";
import { type JSX } from "react";
import toast from "react-hot-toast";
import { TI18nString, TSurvey, TSurveyMatrixQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { isLabelValidForAllLanguages } from "../lib/validation";

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

  const handleAddLabel = (type: "row" | "column") => {
    if (type === "row") {
      const updatedRows = [...question.rows, { id: createId(), label: createI18nString("", languageCodes) }];
      updateQuestion(questionIdx, { rows: updatedRows });
    } else {
      const updatedColumns = [
        ...question.columns,
        { id: createId(), label: createI18nString("", languageCodes) },
      ];
      updateQuestion(questionIdx, { columns: updatedColumns });
    }
  };

  const handleDeleteLabel = (type: "row" | "column", index: number) => {
    const labels = type === "row" ? question.rows : question.columns;
    if (labels.length <= 2) return;

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
    const matrixItems = type === "row" ? [...question.rows] : [...question.columns];

    if (index !== undefined) {
      matrixItems[index] = { ...matrixItems[index], label: matrixLabel };
    } else {
      matrixItems.push({ id: createId(), label: matrixLabel });
    }
    if (type === "row") {
      updateQuestion(questionIdx, { rows: matrixItems });
    } else {
      updateQuestion(questionIdx, { columns: matrixItems });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, type: "row" | "column") => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddLabel(type);
    }
  };

  const handleMatrixDragEnd = (type: "row" | "column", event: DragEndEvent) => {
    const { active, over } = event;

    if (!active || !over || active.id === over.id) return;

    const items = type === "row" ? [...question.rows] : [...question.columns];
    const activeIndex = items.findIndex((item) => item.id === active.id);
    const overIndex = items.findIndex((item) => item.id === over.id);

    if (activeIndex === -1 || overIndex === -1) return;

    const movedItem = items[activeIndex];
    items.splice(activeIndex, 1);
    items.splice(overIndex, 0, movedItem);

    updateQuestion(questionIdx, type === "row" ? { rows: items } : { columns: items });
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
          <div className="mt-2">
            <DndContext id="matrix-rows" onDragEnd={(e) => handleMatrixDragEnd("row", e)}>
              <SortableContext items={question.rows} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2" ref={parent}>
                  {question.rows.map((row, index) => (
                    <MatrixSortableItem
                      key={row.id}
                      choice={row}
                      index={index}
                      type="row"
                      localSurvey={localSurvey}
                      question={question}
                      questionIdx={questionIdx}
                      updateMatrixLabel={updateMatrixLabel}
                      onDelete={(index) => handleDeleteLabel("row", index)}
                      onKeyDown={(e) => handleKeyDown(e, "row")}
                      canDelete={question.rows.length > 2}
                      selectedLanguageCode={selectedLanguageCode}
                      setSelectedLanguageCode={setSelectedLanguageCode}
                      isInvalid={
                        isInvalid &&
                        !isLabelValidForAllLanguages(question.rows[index].label, localSurvey.languages)
                      }
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
          <div className="mt-2">
            <DndContext id="matrix-columns" onDragEnd={(e) => handleMatrixDragEnd("column", e)}>
              <SortableContext items={question.columns} strategy={verticalListSortingStrategy}>
                <div className="flex flex-col gap-2" ref={parent}>
                  {question.columns.map((column, index) => (
                    <MatrixSortableItem
                      key={column.id}
                      choice={column}
                      index={index}
                      type="column"
                      localSurvey={localSurvey}
                      question={question}
                      questionIdx={questionIdx}
                      updateMatrixLabel={updateMatrixLabel}
                      onDelete={(index) => handleDeleteLabel("column", index)}
                      onKeyDown={(e) => handleKeyDown(e, "column")}
                      canDelete={question.columns.length > 2}
                      selectedLanguageCode={selectedLanguageCode}
                      setSelectedLanguageCode={setSelectedLanguageCode}
                      isInvalid={
                        isInvalid &&
                        !isLabelValidForAllLanguages(question.columns[index].label, localSurvey.languages)
                      }
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
