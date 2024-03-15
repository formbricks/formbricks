"use client";

import {
  HashIcon,
  LinkIcon,
  MailIcon,
  MessageSquareTextIcon,
  PhoneIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react";
import { useState } from "react";

import {
  TSurvey,
  TSurveyOpenTextQuestion,
  TSurveyOpenTextQuestionInputType,
} from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import QuestionFormInput from "@formbricks/ui/QuestionFormInput";
import { OptionsSwitcher } from "@formbricks/ui/QuestionTypeSelector";

const questionTypes = [
  { value: "text", label: "Text", icon: <MessageSquareTextIcon className="h-4 w-4" /> },
  { value: "email", label: "Email", icon: <MailIcon className="h-4 w-4" /> },
  { value: "url", label: "URL", icon: <LinkIcon className="h-4 w-4" /> },
  { value: "number", label: "Number", icon: <HashIcon className="h-4 w-4" /> },
  { value: "phone", label: "Phone", icon: <PhoneIcon className="h-4 w-4" /> },
];

interface OpenQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyOpenTextQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInvalid: boolean;
}

export default function OpenQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
}: OpenQuestionFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
  const defaultPlaceholder = getPlaceholderByInputType(question.inputType ?? "text");

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
          <>
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
          </>
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
          <OptionsSwitcher
            options={questionTypes}
            currentOption={question.inputType}
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
