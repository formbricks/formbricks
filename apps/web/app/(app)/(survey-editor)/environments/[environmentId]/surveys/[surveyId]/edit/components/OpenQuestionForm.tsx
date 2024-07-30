"use client";

import { HashIcon, LinkIcon, MailIcon, MessageSquareTextIcon, PhoneIcon, PlusIcon } from "lucide-react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import {
  TSurvey,
  TSurveyOpenTextQuestion,
  TSurveyOpenTextQuestionInputType,
} from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import { Label } from "@formbricks/ui/Label";
import { OptionsSwitch } from "@formbricks/ui/OptionsSwitch";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";

const questionTypes = [
  { value: "text", label: "Text", icon: <MessageSquareTextIcon className="h-4 w-4" /> },
  { value: "email", label: "Email", icon: <MailIcon className="h-4 w-4" /> },
  { value: "url", label: "URL", icon: <LinkIcon className="h-4 w-4" /> },
  { value: "number", label: "Number", icon: <HashIcon className="h-4 w-4" /> },
  { value: "phone", label: "Phone", icon: <PhoneIcon className="h-4 w-4" /> },
];

interface OpenQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyOpenTextQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyOpenTextQuestion>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  isInvalid: boolean;
  attributeClasses: TAttributeClass[];
}

export const OpenQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  attributeClasses,
}: OpenQuestionFormProps): JSX.Element => {
  const defaultPlaceholder = getPlaceholderByInputType(question.inputType ?? "text");
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages ?? []);
  const handleInputChange = (inputType: TSurveyOpenTextQuestionInputType) => {
    const updatedAttributes = {
      inputType: inputType,
      placeholder: createI18nString(getPlaceholderByInputType(inputType), surveyLanguageCodes),
      longAnswer: inputType === "text" ? question.longAnswer : false,
    };
    updateQuestion(questionIdx, updatedAttributes);
  };

  return (
    <form>
      <QuestionFormInput
        id="headline"
        value={question.headline}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        attributeClasses={attributeClasses}
        label={"Question*"}
      />

      <div>
        {question.subheader !== undefined && (
          <div className="inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="subheader"
                value={question.subheader}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                attributeClasses={attributeClasses}
                label={"Description"}
              />
            </div>
          </div>
        )}
        {question.subheader === undefined && (
          <Button
            size="sm"
            variant="minimal"
            className="mt-3"
            type="button"
            onClick={() => {
              updateQuestion(questionIdx, {
                subheader: createI18nString("", surveyLanguageCodes),
              });
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>
      <div className="mt-2">
        <QuestionFormInput
          id="placeholder"
          value={
            question.placeholder
              ? question.placeholder
              : createI18nString(defaultPlaceholder, surveyLanguageCodes)
          }
          localSurvey={localSurvey}
          questionIdx={questionIdx}
          isInvalid={isInvalid}
          updateQuestion={updateQuestion}
          selectedLanguageCode={selectedLanguageCode}
          setSelectedLanguageCode={setSelectedLanguageCode}
          attributeClasses={attributeClasses}
          label={"Placeholder"}
        />
      </div>

      {/* Add a dropdown to select the question type */}
      <div className="mt-3">
        <Label htmlFor="questionType">Input Type</Label>
        <div className="mt-2 flex items-center">
          <OptionsSwitch
            options={questionTypes}
            currentOption={question.inputType}
            handleOptionChange={handleInputChange} // Use the merged function
          />
        </div>
      </div>
    </form>
  );
};

const getPlaceholderByInputType = (inputType: TSurveyOpenTextQuestionInputType) => {
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
};
