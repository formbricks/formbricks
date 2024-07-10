"use client";

import { PlusIcon, TrashIcon } from "lucide-react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TI18nString, TSurvey, TSurveyMatrixQuestion } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";
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
  attributeClasses: TAttributeClass[];
}

export const MatrixQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  attributeClasses,
}: MatrixQuestionFormProps): JSX.Element => {
  const languageCodes = extractLanguageCodes(localSurvey.languages);
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

  return (
    <form>
      <QuestionFormInput
        id="headline"
        value={question.headline}
        label={"Question*"}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        attributeClasses={attributeClasses}
      />
      <div>
        {question.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="subheader"
                value={question.subheader}
                label={"Description"}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                attributeClasses={attributeClasses}
              />
            </div>
          </div>
        )}
        {question.subheader === undefined && (
          <Button
            size="sm"
            variant="minimal"
            className="mt-3"
            type="button"
            onClick={() => {
              updateQuestion(questionIdx, {
                subheader: createI18nString("", languageCodes),
              });
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          {/* Rows section */}
          <Label htmlFor="rows">Rows</Label>
          <div>
            {question.rows.map((_, index) => (
              <div className="flex items-center" onKeyDown={(e) => handleKeyDown(e, "row")}>
                <QuestionFormInput
                  key={`row-${index}`}
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
                  attributeClasses={attributeClasses}
                />
                {question.rows.length > 2 && (
                  <TrashIcon
                    className="ml-2 mt-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
                    onClick={() => handleDeleteLabel("row", index)}
                  />
                )}
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              StartIcon={PlusIcon}
              onClick={(e) => {
                e.preventDefault();
                handleAddLabel("row");
              }}>
              <span>Add row</span>
            </Button>
          </div>
        </div>
        <div>
          {/* Columns section */}
          <Label htmlFor="columns">Columns</Label>
          <div>
            {question.columns.map((_, index) => (
              <div className="flex items-center" onKeyDown={(e) => handleKeyDown(e, "column")}>
                <QuestionFormInput
                  key={`column-${index}`}
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
                  attributeClasses={attributeClasses}
                />
                {question.columns.length > 2 && (
                  <TrashIcon
                    className="ml-2 mt-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
                    onClick={() => handleDeleteLabel("column", index)}
                  />
                )}
              </div>
            ))}
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              StartIcon={PlusIcon}
              onClick={(e) => {
                e.preventDefault();
                handleAddLabel("column");
              }}>
              <span>Add column</span>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
};
