"use client";

import QuestionFormInput from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/QuestionFormInput";
import { TSurvey, TSurveyNPSQuestion } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useState } from "react";
import LocalizedInput from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/LocalizedInput";
import { TI18nString } from "@formbricks/types/i18n";

interface NPSQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyNPSQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInValid: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  languages: string[][];
}

export default function NPSQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
  isInValid,
  localSurvey,
  selectedLanguage,
  setSelectedLanguage,
  languages,
}: NPSQuestionFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
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
        languages={languages}
      />

      <div className="mt-3">
        {showSubheader && (
          <>
            <Label htmlFor="subheader">Description</Label>
            <div className="mt-2 inline-flex w-full items-center">
              <LocalizedInput
                id="subheader"
                name="subheader"
                value={question.subheader as TI18nString}
                languages={languages}
                isInValid={isInValid}
                onChange={(e) => {
                  let translatedSubheader = {
                    ...(question.subheader as TI18nString),
                    [selectedLanguage]: e.target.value,
                  };
                  updateQuestion(questionIdx, { subheader: translatedSubheader });
                }}
                selectedLanguage={selectedLanguage}
                setSelectedLanguage={setSelectedLanguage}
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
