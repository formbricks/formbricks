"use client";

import { PlusIcon, TrashIcon } from "lucide-react";
import { useState } from "react";

import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TSurvey, TSurveyAddressQuestion } from "@formbricks/types/surveys";
import { AdvancedOptionToggle } from "@formbricks/ui/AdvancedOptionToggle";
import { Button } from "@formbricks/ui/Button";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";

interface AddressQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyAddressQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: any) => void;
  lastQuestion: boolean;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
}

export default function AddressQuestionForm({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
}: AddressQuestionFormProps): JSX.Element {
  const [showSubheader, setShowSubheader] = useState(!!question.subheader);
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages ?? []);

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
      />

      <div>
        {showSubheader && (
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
                subheader: createI18nString("", surveyLanguageCodes),
              });
              setShowSubheader(true);
            }}>
            <PlusIcon className="mr-1 h-4 w-4" />
            Add Description
          </Button>
        )}
        <div className="mt-2 font-medium">Settings</div>
        <AdvancedOptionToggle
          isChecked={question.addressRequired}
          onToggle={() => updateQuestion(questionIdx, { addressRequired: !question.addressRequired })}
          htmlId="addressRequired"
          title="Required: Address Line 1"
          description=""
          childBorder
          customContainerClass="p-0 mt-2"></AdvancedOptionToggle>
        <AdvancedOptionToggle
          isChecked={question.addressLine2Required}
          onToggle={() =>
            updateQuestion(questionIdx, { addressLine2Required: !question.addressLine2Required })
          }
          htmlId="addressLine2Required"
          title="Required: Address Line 2"
          description=""
          childBorder
          customContainerClass="p-0 mt-2"></AdvancedOptionToggle>
        <AdvancedOptionToggle
          isChecked={question.cityRequired}
          onToggle={() => updateQuestion(questionIdx, { cityRequired: !question.cityRequired })}
          htmlId="cityRequired"
          title="Required: City / Town"
          description=""
          childBorder
          customContainerClass="p-0 mt-2"></AdvancedOptionToggle>
        <AdvancedOptionToggle
          isChecked={question.stateRequired}
          onToggle={() => updateQuestion(questionIdx, { stateRequired: !question.stateRequired })}
          htmlId="stateRequired"
          title="Required: State / Region"
          description=""
          childBorder
          customContainerClass="p-0 mt-2"></AdvancedOptionToggle>
        <AdvancedOptionToggle
          isChecked={question.zipRequired}
          onToggle={() => updateQuestion(questionIdx, { zipRequired: !question.zipRequired })}
          htmlId="zipRequired"
          title="Required: ZIP / Post Code"
          description=""
          childBorder
          customContainerClass="p-0 mt-2"></AdvancedOptionToggle>
        <AdvancedOptionToggle
          isChecked={question.countryRequired}
          onToggle={() => updateQuestion(questionIdx, { countryRequired: !question.countryRequired })}
          htmlId="countryRequired"
          title="Required: Country"
          description=""
          childBorder
          customContainerClass="p-0 mt-2"></AdvancedOptionToggle>
      </div>
    </form>
  );
}
