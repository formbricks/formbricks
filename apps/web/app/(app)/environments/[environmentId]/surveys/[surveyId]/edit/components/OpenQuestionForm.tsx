"use client";

import LanguageIndicator from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/LanguageIndicator";
import LocalizedInput from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/LocalizedInput";
import QuestionFormInput from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/QuestionFormInput";
import {
  TSurvey,
  TSurveyOpenTextQuestion,
  TSurveyOpenTextQuestionInputType,
} from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { QuestionTypeSelector } from "@formbricks/ui/QuestionTypeSelector";
import { LanguageIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

const questionTypes = [
  { value: "text", label: "Text" },
  { value: "email", label: "Email" },
  { value: "url", label: "URL" },
  { value: "number", label: "Number" },
  { value: "phone", label: "Phone" },
];

interface OpenQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyOpenTextQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInValid: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
}

export default function OpenQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInValid,
  localSurvey,
  selectedLanguage,
  setSelectedLanguage,
}: OpenQuestionFormProps): JSX.Element {
  console.log(question);
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
  const defaultPlaceholder = getPlaceholderByInputType(question.inputType ?? "text");
  const hasI18n = question.headline._i18n_;

  const handleInputChange = (inputType: TSurveyOpenTextQuestionInputType) => {
    const updatedAttributes = {
      inputType: inputType,
      placeholder: getPlaceholderByInputType(inputType),
      longAnswer: inputType === "text" ? question.longAnswer : false,
    };
    updateQuestion(questionIdx, updatedAttributes);
  };

  const environmentId = localSurvey.environmentId;

  return (
    <form>
      <QuestionFormInput
        environmentId={environmentId}
        isInValid={isInValid}
        question={question}
        questionIdx={questionIdx}
        updateQuestion={updateQuestion}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <div className="mt-3">
        {showSubheader && (
          <>
            <Label htmlFor="subheader">Description</Label>
            <div className="mt-2 inline-flex w-full items-center">
              <div className="w-full">
                <LocalizedInput
                  id="subheader"
                  name="subheader"
                  value={question.subheader}
                  isInValid={isInValid}
                  onChange={(e) => {
                    let translatedSubheader = {
                      ...question.subheader,
                      [selectedLanguage]: e.target.value,
                    };
                    updateQuestion(questionIdx, { subheader: translatedSubheader });
                  }}
                  selectedLanguage={selectedLanguage}
                  setSelectedLanguage={setSelectedLanguage}
                />
              </div>

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
            value={question.placeholder ?? defaultPlaceholder}
            onChange={(e) => updateQuestion(questionIdx, { placeholder: e.target.value })}
          />
        </div>
      </div>

      {/* Add a dropdown to select the question type */}
      <div className="mt-3">
        <Label htmlFor="questionType">Input Type</Label>
        <div className="mt-2 flex items-center">
          <QuestionTypeSelector
            questionTypes={questionTypes}
            currentType={question.inputType}
            handleTypeChange={handleInputChange} // Use the merged function
          />
        </div>
      </div>
    </form>
  );
}

function getPlaceholderByInputType(inputType: TSurveyOpenTextQuestionInputType) {
  switch (inputType) {
    case "email":
      return "example@email.com";
    case "url":
      return "http://...";
    case "number":
      return "42";
    case "phone":
      return "+1 123 456 789";
    default:
      return "Type your answer here...";
  }
}
