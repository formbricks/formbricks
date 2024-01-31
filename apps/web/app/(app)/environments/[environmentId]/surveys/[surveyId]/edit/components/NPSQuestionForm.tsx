"use client";

import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import { useState } from "react";

import LocalizedInput from "@formbricks/ee/multiLanguage/components/LocalizedInput";
import { createI18nString } from "@formbricks/ee/multiLanguage/utils/i18n";
import { TSurvey, TSurveyNPSQuestion } from "@formbricks/types/surveys";
import { TI18nString } from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";

interface NPSQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyNPSQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  languages: string[][];
  isInvalid: boolean;
}

export default function NPSQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
  isInvalid,
  localSurvey,
  selectedLanguage,
  setSelectedLanguage,
  languages,
}: NPSQuestionFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);

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

      <div>
        {showSubheader && (
          <div className="mt-2 inline-flex w-full items-center">
            <div className="w-full">
              <LocalizedInput
                id="subheader"
                name="subheader"
                value={question.subheader as TI18nString}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                languages={languages}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguage={selectedLanguage}
                setSelectedLanguage={setSelectedLanguage}
              />
            </div>

            <TrashIcon
              className="ml-2 mt-10 h-4 w-4 cursor-pointer text-slate-400 hover:text-slate-500"
              onClick={() => {
                setShowSubheader(false);
                updateQuestion(questionIdx, { subheader: undefined });
              }}
            />
          </div>
        )}
        {!showSubheader && (
          <Button
            size="sm"
            variant="minimal"
            className="mt-3"
            type="button"
            onClick={() => {
              updateQuestion(questionIdx, {
                subheader: createI18nString("", extractLanguageSymbols(languages)),
              });
              setShowSubheader(true);
            }}>
            {" "}
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>

      <div className="mt-3 flex justify-between space-x-2">
        <div className="w-full">
          <LocalizedInput
            id="lowerLabel"
            name="lowerLabel"
            value={question.lowerLabel as TI18nString}
            localSurvey={localSurvey}
            questionIdx={questionIdx}
            languages={languages}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
          />
        </div>
        <div className="w-full">
          <LocalizedInput
            id="upperLabel"
            name="upperLabel"
            value={question.upperLabel as TI18nString}
            localSurvey={localSurvey}
            questionIdx={questionIdx}
            languages={languages}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
          />
        </div>
      </div>

      {!question.required && (
        <div className="mt-3">
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
        </div>
      )}
    </form>
  );
}
