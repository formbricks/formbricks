import React, { useState } from "react";
import { TSurveyOpenTextQuestion, TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { Button, Input, Label, QuestionTypeSelector } from "@formbricks/ui";
import { TrashIcon, PlusIcon } from "@heroicons/react/24/solid";

const questionTypes = [
  { value: "text", label: "Text 📝" },
  { value: "email", label: "Email 📧" },
  { value: "url", label: "URL 🌐" },
  { value: "number", label: "Number 1️⃣" },
  { value: "phone", label: "Phone ☎️" },
];

interface OpenQuestionFormProps {
  localSurvey: TSurveyWithAnalytics;
  question: TSurveyOpenTextQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInValid: boolean;
}

export default function OpenQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInValid,
}: OpenQuestionFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);

  const handleQuestionTypeChange = (value: string) => {
    updateQuestion(questionIdx, { inputType: value });
  };

  return (
    <form>
      <div className="mt-3">
        <Label htmlFor="headline">Question</Label>
        <div className="mt-2">
          <Input
            autoFocus
            id="headline"
            name="headline"
            value={question.headline}
            onChange={(e) => updateQuestion(questionIdx, { headline: e.target.value })}
            isInvalid={isInValid && question.headline.trim() === ""}
          />
        </div>
      </div>

      <div className="mt-3">
        {showSubheader && (
          <>
            <Label htmlFor="subheader">Description</Label>
            <div className="mt-2 inline-flex w-full items-center">
              <Input
                id="subheader"
                name="subheader"
                value={question.subheader}
                onChange={(e) => updateQuestion(questionIdx, { subheader: e.target.value })}
              />
              <TrashIcon
                className="ml-2 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
                onClick={() => {
                  setShowSubheader(false);
                  updateQuestion(questionIdx, { subheader: "" });
                }}
              />
            </div>
          </>
        )}
        {!showSubheader && (
          <Button size="sm" variant="minimal" type="button" onClick={() => setShowSubheader(true)}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>

      <div className="mt-3">
        <Label htmlFor="placeholder">Placeholder</Label>
        <div className="mt-2">
          <Input
            id="placeholder"
            name="placeholder"
            value={question.placeholder}
            onChange={(e) => updateQuestion(questionIdx, { placeholder: e.target.value })}
          />
        </div>
      </div>

      {/* Add a dropdown to select the question type */}
      <div className="mt-3">
        <Label htmlFor="questionType">Question Type</Label>
        <div className="flex items-center">
          <QuestionTypeSelector
            questionTypes={questionTypes}
            currentType={question.inputType}
            handleTypeChange={handleQuestionTypeChange}
          />
        </div>
      </div>
    </form>
  );
}
