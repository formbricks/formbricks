"use client";

import { isLabelValidForAllLanguages } from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/lib/validation";
import { PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";

import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TI18nString, TSurvey, TSurveyMatrixQuestion } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";

interface MatrixQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyMatrixQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyMatrixQuestion>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
}

export default function MatrixQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
}: MatrixQuestionFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
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
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
      />
      <div>
        {showSubheader && (
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
              />
            </div>

            <TrashIcon
              className="ml-2 mt-10 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
              onClick={() => {
                setShowSubheader(false);
                updateQuestion(questionIdx, { subheader: undefined });
              }}
            />
          </div>
        )}
        {!showSubheader && (
          <Button
            size="sm"
            variant="minimal"
            className="mt-3"
            type="button"
            onClick={() => setShowSubheader(true)}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>
      <div className="mt-3 grid grid-cols-2 gap-4">
        <div>
          {/* Rows section */}
          <Label htmlFor="rows">Rows</Label>
          <div className="mt-3">
            {question.rows.map((_, index) => (
              <div className="flex items-center" onKeyDown={(e) => handleKeyDown(e, "row")}>
                <QuestionFormInput
                  key={`row-${index}`}
                  id={`row-${index}`}
                  localSurvey={localSurvey}
                  questionIdx={questionIdx}
                  value={question.rows[index]}
                  updateMatrixLabel={updateMatrixLabel}
                  selectedLanguageCode={selectedLanguageCode}
                  setSelectedLanguageCode={setSelectedLanguageCode}
                  isInvalid={
                    isInvalid && !isLabelValidForAllLanguages(question.rows[index], localSurvey.languages)
                  }
                />
                {question.rows.length > 2 && (
                  <TrashIcon
                    className="ml-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
                    onClick={() => handleDeleteLabel("row", index)}
                  />
                )}
              </div>
            ))}
            <Button
              variant="minimal"
              className="mt-2 space-x-2"
              onClick={(e) => {
                e.preventDefault();
                handleAddLabel("row");
              }}>
              <PlusIcon className="h-4 w-4" />
              <span>Add Row</span>
            </Button>
          </div>
        </div>
        <div>
          {/* Columns section */}
          <Label htmlFor="columns">Columns</Label>
          <div className="mt-3 ">
            {question.columns.map((_, index) => (
              <div className="flex items-center" onKeyDown={(e) => handleKeyDown(e, "column")}>
                <QuestionFormInput
                  key={`column-${index}`}
                  id={`column-${index}`}
                  localSurvey={localSurvey}
                  questionIdx={questionIdx}
                  value={question.columns[index]}
                  updateMatrixLabel={updateMatrixLabel}
                  selectedLanguageCode={selectedLanguageCode}
                  setSelectedLanguageCode={setSelectedLanguageCode}
                  isInvalid={
                    isInvalid && !isLabelValidForAllLanguages(question.columns[index], localSurvey.languages)
                  }
                />
                {question.columns.length > 2 && (
                  <TrashIcon
                    className="ml-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
                    onClick={() => handleDeleteLabel("column", index)}
                  />
                )}
              </div>
            ))}
            <Button
              variant="minimal"
              className="mt-2 space-x-2"
              onClick={(e) => {
                e.preventDefault();
                handleAddLabel("column");
              }}>
              <PlusIcon className="h-4 w-4" />
              <span>Add Column</span>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
