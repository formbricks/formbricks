"use client";

import QuestionFormInput from "@/app/(app)/environments/[environmentId]/surveys/[surveyId]/edit/components/QuestionFormInput";
import { md } from "@formbricks/lib/markdownIt";
import { TSurvey, TSurveyConsentQuestion } from "@formbricks/types/surveys";
import { Editor } from "@formbricks/ui/Editor";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { useState } from "react";

interface ConsentQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyConsentQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  isInValid: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
}

export default function ConsentQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInValid,
  localSurvey,
  selectedLanguage,
  setSelectedLanguage,
}: ConsentQuestionFormProps): JSX.Element {
  const [firstRender, setFirstRender] = useState(true);
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
        <Label htmlFor="subheader">Description</Label>
        <div className="mt-2">
          <Editor
            getText={() =>
              md.render(
                question.html || "We would love to talk to you and learn more about how you use our product."
              )
            }
            setText={(value: string) => {
              updateQuestion(questionIdx, { html: value });
            }}
            excludedToolbarItems={["blockType"]}
            disableLists
            firstRender={firstRender}
            setFirstRender={setFirstRender}
          />
        </div>
      </div>

      <div className="mt-3">
        <Label htmlFor="label">Checkbox Label</Label>
        <Input
          id="label"
          name="label"
          className="mt-2"
          value={question.label}
          placeholder="I agree to the terms and conditions"
          onChange={(e) => updateQuestion(questionIdx, { label: e.target.value })}
          isInvalid={isInValid && question.label.trim() === ""}
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
