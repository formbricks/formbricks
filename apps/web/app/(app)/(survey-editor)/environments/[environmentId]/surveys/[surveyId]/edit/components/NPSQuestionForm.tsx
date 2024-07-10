"use client";

import { PlusIcon } from "lucide-react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyNPSQuestion } from "@formbricks/types/surveys/types";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { Button } from "@formbricks/ui/Button";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";

interface NPSQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyNPSQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyNPSQuestion>) => void;
  lastQuestion: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  isInvalid: boolean;
  attributeClasses: TAttributeClass[];
}

export const NPSQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  lastQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  attributeClasses,
}: NPSQuestionFormProps): JSX.Element => {
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages);
  return (
    <form>
      <QuestionFormInput
        id="headline"
        value={question.headline}
        label={"Question*"}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        isInvalid={isInvalid}
        updateQuestion={updateQuestion}
        selectedLanguageCode={selectedLanguageCode}
        setSelectedLanguageCode={setSelectedLanguageCode}
        attributeClasses={attributeClasses}
      />

      <div>
        {question.subheader !== undefined && (
          <div className="mt-2 inline-flex w-full items-center">
            <div className="w-full">
              <QuestionFormInput
                id="subheader"
                value={question.subheader}
                label={"Description"}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                attributeClasses={attributeClasses}
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
            {" "}
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
      </div>

      <div className="mt-3 flex justify-between space-x-2">
        <div className="w-full">
          <QuestionFormInput
            id="lowerLabel"
            value={question.lowerLabel}
            label={"Lower Label"}
            localSurvey={localSurvey}
            questionIdx={questionIdx}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            attributeClasses={attributeClasses}
          />
        </div>
        <div className="w-full">
          <QuestionFormInput
            id="upperLabel"
            value={question.upperLabel}
            label={"Upper Label"}
            localSurvey={localSurvey}
            questionIdx={questionIdx}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            attributeClasses={attributeClasses}
          />
        </div>
      </div>

      {!question.required && (
        <div className="mt-3">
          <QuestionFormInput
            id="buttonLabel"
            value={question.buttonLabel}
            label={`"Next" Button Label`}
            localSurvey={localSurvey}
            questionIdx={questionIdx}
            maxLength={48}
            placeholder={lastQuestion ? "Finish" : "Next"}
            isInvalid={isInvalid}
            updateQuestion={updateQuestion}
            selectedLanguageCode={selectedLanguageCode}
            setSelectedLanguageCode={setSelectedLanguageCode}
            attributeClasses={attributeClasses}
          />
        </div>
      )}

      <AdvancedOptionToggle
        isChecked={question.isColorCodingEnabled}
        onToggle={() => updateQuestion(questionIdx, { isColorCodingEnabled: !question.isColorCodingEnabled })}
        htmlId="isColorCodingEnabled"
        title="Add color coding"
        description="Add red, orange and green color codes to the options."
        childBorder
        customContainerClass="p-0 mt-4"
      />
    </form>
  );
};
