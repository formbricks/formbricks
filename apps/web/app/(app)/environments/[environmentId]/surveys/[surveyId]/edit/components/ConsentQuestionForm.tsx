"use client";

import { useEffect, useState } from "react";

import { LocalizedEditor } from "@formbricks/ee/multiLanguage/components/LocalizedEditor";
import LocalizedInput from "@formbricks/ee/multiLanguage/components/LocalizedInput";
import { TLanguage } from "@formbricks/types/product";
import { TSurvey, TSurveyConsentQuestion } from "@formbricks/types/surveys";
import { Label } from "@formbricks/ui/Label";

interface ConsentQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyConsentQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  surveyLanguages: TLanguage[];
  isInvalid: boolean;
  defaultLanguageSymbol: string;
}

export default function ConsentQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguage,
  setSelectedLanguage,
  surveyLanguages,
  defaultLanguageSymbol,
}: ConsentQuestionFormProps): JSX.Element {
  const [firstRender, setFirstRender] = useState(true);

  useEffect(() => {
    setFirstRender(true);
  }, [selectedLanguage]);

  return (
    <form>
      <LocalizedInput
        id="headline"
        name="headline"
        value={question.headline}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        surveyLanguages={surveyLanguages}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        defaultLanguageSymbol={defaultLanguageSymbol}
      />

      <div className="mt-3">
        <Label htmlFor="subheader">Description</Label>
        <div className="mt-2">
          <LocalizedEditor
            id="subheader"
            value={question.html}
            localSurvey={localSurvey}
            surveyLanguages={surveyLanguages}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            firstRender={firstRender}
            setFirstRender={setFirstRender}
            questionIdx={questionIdx}
            defaultLanguageSymbol={defaultLanguageSymbol}
          />
        </div>
      </div>

      <LocalizedInput
        id="label"
        name="label"
        label="Checkbox Label"
        placeholder="I agree to the terms and conditions"
        value={question.label}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        surveyLanguages={surveyLanguages}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
        defaultLanguageSymbol={defaultLanguageSymbol}
      />
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
