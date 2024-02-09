"use client";

import { PlusIcon, TrashIcon } from "@heroicons/react/24/solid";
import {
  ChatBubbleBottomCenterTextIcon,
  EnvelopeIcon,
  HashtagIcon,
  LinkIcon,
  PhoneIcon,
} from "@heroicons/react/24/solid";
import { useState } from "react";

import LocalizedInput from "@formbricks/ee/multiLanguage/components/LocalizedInput";
import { createI18nString, extractLanguageIds } from "@formbricks/lib/i18n/utils";
import { TLanguage } from "@formbricks/types/product";
import {
  TSurvey,
  TSurveyOpenTextQuestion,
  TSurveyOpenTextQuestionInputType,
} from "@formbricks/types/surveys";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { OptionsSwitcher } from "@formbricks/ui/QuestionTypeSelector";

const questionTypes = [
  { value: "text", label: "Text", icon: <ChatBubbleBottomCenterTextIcon /> },
  { value: "email", label: "Email", icon: <EnvelopeIcon /> },
  { value: "url", label: "URL", icon: <LinkIcon /> },
  { value: "number", label: "Number", icon: <HashtagIcon /> },
  { value: "phone", label: "Phone", icon: <PhoneIcon /> },
];

interface OpenQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyOpenTextQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  selectedLanguage: string;
  setSelectedLanguage: (language: string) => void;
  surveyLanguages: TLanguage[];
  isInvalid: boolean;
  defaultLanguageId: string;
}

export default function OpenQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguage,
  setSelectedLanguage,
  surveyLanguages,
  defaultLanguageId,
}: OpenQuestionFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
  const defaultPlaceholder = getPlaceholderByInputType(question.inputType ?? "text");
  const surveyLanguageIds = extractLanguageIds(surveyLanguages);
  const handleInputChange = (inputType: TSurveyOpenTextQuestionInputType) => {
    const updatedAttributes = {
      inputType: inputType,
      placeholder: createI18nString(
        getPlaceholderByInputType(inputType),
        surveyLanguageIds,
        defaultLanguageId
      ),
      longAnswer: inputType === "text" ? question.longAnswer : false,
    };
    updateQuestion(questionIdx, updatedAttributes);
  };

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
        defaultLanguageId={defaultLanguageId}
      />

      <div>
        {showSubheader && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <LocalizedInput
                id="subheader"
                name="subheader"
                value={question.subheader}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                surveyLanguages={surveyLanguages}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguage={selectedLanguage}
                setSelectedLanguage={setSelectedLanguage}
                defaultLanguageId={defaultLanguageId}
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
                subheader: createI18nString("", surveyLanguageIds, defaultLanguageId),
              });
              setShowSubheader(true);
            }}>
            {" "}
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>

      <div className="mt-2">
        <LocalizedInput
          id="placeholder"
          name="placeholder"
          value={
            question.placeholder && question.placeholder[selectedLanguage]
              ? question.placeholder
              : createI18nString(defaultPlaceholder, surveyLanguageIds, defaultLanguageId)
          }
          surveyLanguages={surveyLanguages}
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          isInvalid={isInvalid}
          updateQuestion={updateQuestion}
          selectedLanguage={selectedLanguage}
          setSelectedLanguage={setSelectedLanguage}
          defaultLanguageId={defaultLanguageId}
        />
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
