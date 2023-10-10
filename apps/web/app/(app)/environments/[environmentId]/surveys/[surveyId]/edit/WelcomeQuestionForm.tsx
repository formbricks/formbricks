"use client";

import { md } from "@formbricks/lib/markdownIt";
import { TSurveyWelcomeQuestion, TSurveyWithAnalytics } from "@formbricks/types/v1/surveys";
import { Editor, Input, Label, Switch } from "@formbricks/ui";
import { useState } from "react";

interface WelcomeQuestionFormProps {
  localSurvey: TSurveyWithAnalytics;
  question: TSurveyWelcomeQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInValid: boolean;
}

export default function WelcomeQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
  isInValid,
}: WelcomeQuestionFormProps): JSX.Element {
  const [firstRender, setFirstRender] = useState(true);
  console.log(question);

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

      {/* Add Company Logo Upload Field */}
      <div className="mt-3">
        <Label htmlFor="companyLogo">Company Logo</Label>
        <div className="mt-2">
          <input
            type="file"
            id="companyLogo"
            name="companyLogo"
            accept="image/*"
            onChange={(e) => {
              const selectedFile = e.target?.files?.[0];
              if (selectedFile) {
                updateQuestion(questionIdx, { companyLogo: selectedFile });
              }
            }}
          />
        </div>
      </div>

      <div className="mt-3 flex justify-between gap-8">
        <div className="flex w-full space-x-2">
          <div className="w-full">
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
        </div>
      </div>

      {/* Add Time to Finish Toggle */}
      <div className="mt-3 flex items-center">
        <div className="mr-2">
          <Switch
            id="timeToFinish"
            name="timeToFinish"
            checked={question.timeToFinish}
            onCheckedChange={() => updateQuestion(questionIdx, { timeToFinish: !question.timeToFinish })}
          />
        </div>
        <Label htmlFor="timeToFinish">Time to Finish</Label>
      </div>
    </form>
  );
}
