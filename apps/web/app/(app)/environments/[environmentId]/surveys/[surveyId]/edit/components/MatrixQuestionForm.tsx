"use client";

import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { Plus } from "lucide-react";
import { useState } from "react";

import { TSurvey, TSurveyMatrixQuestion } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import QuestionFormInput from "@formbricks/ui/QuestionFormInput";

interface MatrixQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyMatrixQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInvalid: boolean;
}

interface MatrixInputProps {
  question: TSurveyMatrixQuestion;
  index: number;
  type: "row" | "column";
  onDelete: () => void;
  handleOnChange: (index: number, type: "row" | "column", e: React.ChangeEvent<HTMLInputElement>) => void;
}

const MatrixInput = ({ question, index, type, onDelete, handleOnChange }: MatrixInputProps) => {
  return (
    <div className="flex items-center">
      <Input onChange={(e) => handleOnChange(index, type, e)} />
      {(type === "row" ? question.rows.length > 1 : question.columns.length > 1) && (
        <TrashIcon
          className="ml-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
          onClick={onDelete}
        />
      )}
    </div>
  );
};

export default function MatrixQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
}: MatrixQuestionFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);

  const handleAddRow = () => {
    const updatedRows = [...question.rows, ""];
    updateQuestion(questionIdx, { rows: updatedRows });
  };

  const handleAddColumn = () => {
    const updatedColumns = [...question.columns, ""];
    updateQuestion(questionIdx, { columns: updatedColumns });
  };

  const handleDeleteRow = (index) => {
    const updatedRows = question.rows.filter((_, idx) => idx !== index);
    updateQuestion(questionIdx, { ...question, rows: updatedRows });
  };

  const handleDeleteColumn = (index) => {
    const updatedColumns = question.columns.filter((_, idx) => idx !== index);
    updateQuestion(questionIdx, { ...question, columns: updatedColumns });
  };

  const handleOnChange = (index: number, type: "row" | "column", e) => {
    const value = e.target.value;
    if (type === "row") {
      const updatedRows = [...question.rows];
      updatedRows[index] = value; // Update the value at the specified index
      updateQuestion(questionIdx, { rows: updatedRows });
    } else if (type === "column") {
      const updatedColumns = [...question.columns];
      updatedColumns[index] = value; // Update the value at the specified index
      updateQuestion(questionIdx, { columns: updatedColumns });
    }
  };

  const environmentId = localSurvey.environmentId;

  return (
    <form>
      <QuestionFormInput
        localSurvey={localSurvey}
        environmentId={environmentId}
        isInvalid={isInvalid}
        questionId={question.id}
        questionIdx={questionIdx}
        updateQuestion={updateQuestion}
        type="headline"
      />
      <div>
        {showSubheader && (
          <div className="flex w-full items-center">
            <QuestionFormInput
              localSurvey={localSurvey}
              environmentId={environmentId}
              isInvalid={isInvalid}
              questionId={question.id}
              questionIdx={questionIdx}
              updateQuestion={updateQuestion}
              type="subheader"
            />
            <TrashIcon
              className="ml-2 mt-10 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
              onClick={() => {
                setShowSubheader(false);
                updateQuestion(questionIdx, { subheader: "" });
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
          <div className="mt-3 space-y-2">
            {question.rows.map((_, index) => (
              <MatrixInput
                question={question}
                key={index}
                index={index}
                type="row"
                onDelete={() => handleDeleteRow(index)}
                handleOnChange={handleOnChange}
              />
            ))}
            <Button
              variant="minimal"
              className="space-x-2"
              onClick={(e) => {
                e.preventDefault();
                handleAddRow();
              }}>
              <Plus className="h-4 w-4" />
              <span>Add Row</span>
            </Button>
          </div>
        </div>
        <div>
          {/* Columns section */}
          <Label htmlFor="columns">Columns</Label>
          <div className="mt-3 space-y-2">
            {question.columns.map((_, index) => (
              <MatrixInput
                question={question}
                key={index}
                index={index}
                type="column"
                onDelete={() => handleDeleteColumn(index)}
                handleOnChange={handleOnChange}
              />
            ))}
            <Button
              variant="minimal"
              className="space-x-2"
              onClick={(e) => {
                e.preventDefault();
                handleAddColumn();
              }}>
              <Plus className="h-4 w-4" />
              <span>Add Column</span>
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
