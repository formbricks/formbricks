"use client";

import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { Button } from "@/modules/ui/components/button";
import { Label } from "@/modules/ui/components/label";
import { ShuffleOptionSelect } from "@/modules/ui/components/shuffle-option-select";
import { TooltipRenderer } from "@/modules/ui/components/tooltip";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { useTranslate } from "@tolgee/react";
import { PlusIcon, TrashIcon } from "lucide-react";
import type { JSX } from "react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TI18nString, TSurvey, TSurveyMatrixQuestion } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { isLabelValidForAllLanguages } from "../lib/validation";

interface MatrixQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyMatrixQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyMatrixQuestion>) => void;
  lastQuestion: boolean;
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
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                label={t("common.description")}
                locale={locale}
              />
            </div>
          </div>
        )}

        {question.tooltip !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="tooltip"
                value={question.tooltip}
                label={t("environments.surveys.edit.tooltip")}
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
            className="mr-3 mt-3"
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
        {question.tooltip === undefined && (
          <Button
            size="sm"
            variant="secondary"
            className="mt-4"
            type="button"
            onClick={() => {
              updateQuestion(questionIdx, {
                tooltip: createI18nString("", languageCodes),
              });
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            {t("environments.surveys.edit.add_tooltip")}
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          {/* Rows section */}
          <Label htmlFor="rows">{t("environments.surveys.edit.rows")}</Label>
          <div className="mt-2 flex flex-col gap-2" ref={parent}>
            {question.rows.map((_, index) => (
              <div
                className="flex items-center"
                onKeyDown={(e) => handleKeyDown(e, "row")}
                key={`row-${index}`}>
                <QuestionFormInput
                  id={`row-${index}`}
                  label={""}
                  localSurvey={localSurvey}
                  questionIdx={questionIdx}
                  value={question.rows[index]}
                  updateMatrixLabel={updateMatrixLabel}
                  selectedLanguageCode={selectedLanguageCode}
                  setSelectedLanguageCode={setSelectedLanguageCode}
                  isInvalid={
                    isInvalid && !isLabelValidForAllLanguages(question.rows[index], localSurvey.languages)
                  }
                  locale={locale}
                />
                {question.rows.length > 2 && (
                  <TooltipRenderer tooltipContent={t("common.delete")}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteLabel("row", index);
                      }}>
                      <TrashIcon />
                    </Button>
                  </TooltipRenderer>
                )}
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              className="w-fit"
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
          <div className="mt-2 flex flex-col gap-2" ref={parent}>
            {question.columns.map((_, index) => (
              <div
                className="flex items-center"
                onKeyDown={(e) => handleKeyDown(e, "column")}
                key={`column-${index}`}>
                <QuestionFormInput
                  id={`column-${index}`}
                  label={""}
                  localSurvey={localSurvey}
                  questionIdx={questionIdx}
                  value={question.columns[index]}
                  updateMatrixLabel={updateMatrixLabel}
                  selectedLanguageCode={selectedLanguageCode}
                  setSelectedLanguageCode={setSelectedLanguageCode}
                  isInvalid={
                    isInvalid && !isLabelValidForAllLanguages(question.columns[index], localSurvey.languages)
                  }
                  locale={locale}
                />
                {question.columns.length > 2 && (
                  <TooltipRenderer tooltipContent={t("common.delete")}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-2"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteLabel("column", index);
                      }}>
                      <TrashIcon />
                    </Button>
                  </TooltipRenderer>
                )}
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              className="w-fit"
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
