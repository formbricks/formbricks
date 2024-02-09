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
  selectedLanguageId: string;
  setSelectedLanguageId: (languageId: string) => void;
  surveyLanguages: TLanguage[];
  isInvalid: boolean;
  defaultLanguageId: string;
}

export default function ConsentQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageId,
  setSelectedLanguageId,
  surveyLanguages,
  defaultLanguageId,
}: ConsentQuestionFormProps): JSX.Element {
  const [firstRender, setFirstRender] = useState(true);

  useEffect(() => {
    setFirstRender(true);
  }, [selectedLanguageId]);

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
        selectedLanguageId={selectedLanguageId}
        setSelectedLanguageId={setSelectedLanguageId}
        defaultLanguageId={defaultLanguageId}
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
            selectedLanguageId={selectedLanguageId}
            setSelectedLanguageId={setSelectedLanguageId}
            firstRender={firstRender}
            setFirstRender={setFirstRender}
            questionIdx={questionIdx}
            defaultLanguageId={defaultLanguageId}
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
        selectedLanguageId={selectedLanguageId}
        setSelectedLanguageId={setSelectedLanguageId}
        defaultLanguageId={defaultLanguageId}
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
