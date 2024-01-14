"use client";

import QuestionFormInput from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/QuestionFormInput";
import { useEffect, useState } from "react";

import { LocalizedEditor } from "@formbricks/ee/multiLanguage/components/LocalizedEditor";
import LocalizedInput from "@formbricks/ee/multiLanguage/components/LocalizedInput";
import { TI18nString, TSurvey, TSurveyConsentQuestion } from "@formbricks/types/surveys";
import { Label } from "@formbricks/ui/Label";

interface ConsentQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyConsentQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  isInValid: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  languages: string[][];
}

export default function ConsentQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInValid,
  localSurvey,
  selectedLanguage,
  setSelectedLanguage,
  languages,
}: ConsentQuestionFormProps): JSX.Element {
  const [firstRender, setFirstRender] = useState(true);
  const environmentId = localSurvey.environmentId;
  useEffect(() => {
    setFirstRender(true);
  }, [selectedLanguage]);

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
        <Label htmlFor="subheader">Description</Label>
        <div className="mt-2">
          <LocalizedEditor
            id="subheader"
            value={question.html as TI18nString}
            languages={languages}
            isInValid={isInValid}
            updateQuestion={updateQuestion}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            firstRender={firstRender}
            setFirstRender={setFirstRender}
            questionIdx={questionIdx}
          />
        </div>
      </div>

      <div className="mt-3">
        <Label htmlFor="label">Checkbox Label</Label>
        <LocalizedInput
          id="label"
          name="label"
          value={question.label as TI18nString}
          languages={languages}
          isInValid={isInValid}
          onChange={(e) => {
            let translatedLabel = {
              ...(question.label as TI18nString),
              [selectedLanguage]: e.target.value,
            };
            updateQuestion(questionIdx, { label: translatedLabel });
          }}
          placeholder="I agree to the terms and conditions"
          selectedLanguage={selectedLanguage}
          setSelectedLanguage={setSelectedLanguage}
        />
      </div>
      {/* <div className="mt-3">
        <Label htmlFor="buttonLabel">Button Label</Label>
        <Input
          id="buttonLabel"
          name="buttonLabel"
          className="mt-2"
          value={question.buttonLabel}
          placeholder={lastQuestion ? "Finish" : "Next"}
          onChange={(e) => updateQuestion(questionIdx, { buttonLabel: e.target.value })}
        />
      </div> */}
    </form>
  );
}
