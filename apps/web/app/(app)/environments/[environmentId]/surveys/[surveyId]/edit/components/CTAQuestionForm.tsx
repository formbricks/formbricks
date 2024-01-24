"use client";

import { useEffect, useState } from "react";

import { LocalizedEditor } from "@formbricks/ee/multiLanguage/components/LocalizedEditor";
import LocalizedInput from "@formbricks/ee/multiLanguage/components/LocalizedInput";
import { TSurvey, TSurveyCTAQuestion } from "@formbricks/types/surveys";
import { TI18nString } from "@formbricks/types/surveys";
import { Input } from "@formbricks/ui/Input";
import { Label } from "@formbricks/ui/Label";
import { RadioGroup, RadioGroupItem } from "@formbricks/ui/RadioGroup";

interface CTAQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyCTAQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  languages: string[][];
  isInvalid: boolean;
}

export default function CTAQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
  isInvalid,
  localSurvey,
  selectedLanguage,
  setSelectedLanguage,
  languages,
}: CTAQuestionFormProps): JSX.Element {
  const [firstRender, setFirstRender] = useState(true);

  useEffect(() => {
    setFirstRender(true);
  }, [selectedLanguage]);

  return (
    <form>
      <LocalizedInput
        id="headline"
        name="headline"
        value={question.headline as TI18nString}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        languages={languages}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguage={selectedLanguage}
        setSelectedLanguage={setSelectedLanguage}
      />

      <div className="mt-3">
        <Label htmlFor="subheader">Description</Label>
        <div className="mt-2">
          <LocalizedEditor
            id="subheader"
            value={question.html as TI18nString}
            localSurvey={localSurvey}
            languages={languages}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            firstRender={firstRender}
            setFirstRender={setFirstRender}
            questionIdx={questionIdx}
          />
        </div>
      </div>

      <RadioGroup
        className="mt-3 flex"
        defaultValue="internal"
        value={question.buttonExternal ? "external" : "internal"}
        onValueChange={(e) => updateQuestion(questionIdx, { buttonExternal: e === "external" })}>
        <div className="flex items-center space-x-2 rounded-lg border border-slate-200 p-3 dark:border-slate-500">
          <RadioGroupItem value="internal" id="internal" className="bg-slate-50" />
          <Label htmlFor="internal" className="cursor-pointer dark:text-slate-200">
            Button to continue in survey
          </Label>
        </div>
        <div className="flex items-center space-x-2 rounded-lg border border-slate-200 p-3 dark:border-slate-500">
          <RadioGroupItem value="external" id="external" className="bg-slate-50" />
          <Label htmlFor="external" className="cursor-pointer dark:text-slate-200">
            Button to link to external URL
          </Label>
        </div>
      </RadioGroup>

      <div className="mt-2 flex justify-between gap-8">
        <div className="flex w-full space-x-2">
          <LocalizedInput
            id="buttonLabel"
            name="buttonLabel"
            value={question.buttonLabel as TI18nString}
            localSurvey={localSurvey}
            questionIdx={questionIdx}
            maxLength={48}
            placeholder={lastQuestion ? "Finish" : "Next"}
            languages={languages}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
          />

          {questionIdx !== 0 && (
            <LocalizedInput
              id="backButtonLabel"
              name="backButtonLabel"
              value={question.backButtonLabel as TI18nString}
              localSurvey={localSurvey}
              questionIdx={questionIdx}
              maxLength={48}
              placeholder={"Back"}
              languages={languages}
              isInvalid={isInvalid}
              updateQuestion={updateQuestion}
              selectedLanguage={selectedLanguage}
              setSelectedLanguage={setSelectedLanguage}
            />
          )}
        </div>
      </div>

      {question.buttonExternal && (
        <div className="mt-3 flex-1">
          <Label htmlFor="buttonLabel">Button URL</Label>
          <div className="mt-2">
            <Input
              id="buttonUrl"
              name="buttonUrl"
              value={question.buttonUrl}
              placeholder="https://website.com"
              onChange={(e) => updateQuestion(questionIdx, { buttonUrl: e.target.value })}
            />
          </div>
        </div>
      )}

      {!question.required && (
        <div className="mt-3 flex-1">
          <Label htmlFor="buttonLabel">Skip Button Label</Label>
          <div className="mt-2">
            <LocalizedInput
              id="dismissButtonLabel"
              name="dismissButtonLabel"
              value={question.dismissButtonLabel as TI18nString}
              localSurvey={localSurvey}
              questionIdx={questionIdx}
              placeholder={"skip"}
              languages={languages}
              isInvalid={isInvalid}
              updateQuestion={updateQuestion}
              selectedLanguage={selectedLanguage}
              setSelectedLanguage={setSelectedLanguage}
            />
          </div>
        </div>
      )}
    </form>
  );
}
