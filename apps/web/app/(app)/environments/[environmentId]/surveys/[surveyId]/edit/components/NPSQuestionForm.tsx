"use client";

import { PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";

import { TSurvey, TSurveyNPSQuestion } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import QuestionFormInput from "@formbricks/ui/QuestionFormInput";

interface NPSQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyNPSQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInvalid: boolean;
}

export default function NPSQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
  isInvalid,
  localSurvey,
}: NPSQuestionFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
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
            <div className=" flex w-full items-center">
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

      <div className="mt-3 flex justify-between">
        <div>
          <Label htmlFor="subheader">Lower label</Label>
          <div className="mt-2">
            <Input
              id="subheader"
              name="subheader"
              value={question.lowerLabel}
              onChange={(e) => updateQuestion(questionIdx, { lowerLabel: e.target.value })}
            />
          </div>
        </div>
        <div>
          <Label htmlFor="subheader">Upper label</Label>
          <div className="mt-2">
            <Input
              id="subheader"
              name="subheader"
              value={question.upperLabel}
              onChange={(e) => updateQuestion(questionIdx, { upperLabel: e.target.value })}
            />
          </div>
        </div>
      </div>

      {!question.required && (
        <div className="mt-3">
          <Label htmlFor="buttonLabel">Button Label</Label>
          <div className="mt-2">
            <Input
              id="buttonLabel"
              name="buttonLabel"
              value={question.buttonLabel}
              placeholder={lastQuestion ? "Finish" : "Next"}
              onChange={(e) => updateQuestion(questionIdx, { buttonLabel: e.target.value })}
            />
          </div>
        </div>
      )}
    </form>
  );
}
