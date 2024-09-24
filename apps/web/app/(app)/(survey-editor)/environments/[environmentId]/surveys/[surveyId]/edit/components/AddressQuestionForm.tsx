"use client";

import { PlusIcon } from "lucide-react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyAddressQuestion } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";
import { Switch } from "@formbricks/ui/Switch";

interface AddressQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyAddressQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyAddressQuestion>) => void;
  lastQuestion: boolean;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  attributeClasses: TAttributeClass[];
}

export const AddressQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  attributeClasses,
}: AddressQuestionFormProps): JSX.Element => {
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages ?? []);

  const fields = [
    {
      id: "addressLine1",
      label: "Address Line 1",
      ...question.addressLine1,
    },
    {
      id: "addressLine2",
      label: "Address Line 2",
      ...question.addressLine2,
    },
    {
      id: "city",
      label: "City",
      ...question.city,
    },
    {
      id: "state",
      label: "State",
      ...question.state,
    },
    {
      id: "zip",
      label: "Zip",
      ...question.zip,
    },
    {
      id: "country",
      label: "Country",
      ...question.country,
    },
  ];

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
          <div className="inline-flex w-full items-center">
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
            className="mt-4"
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
        <div className="mt-2 font-medium">Settings</div>

        <table className="mt-4 w-1/2 table-fixed">
          <thead>
            <tr className="text-left font-medium text-slate-800">
              <th className="w-1/2 text-sm">Address Fields</th>
              <th className="w-1/4 text-sm">Show</th>
              <th className="w-1/4 text-sm">Required</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr className="text-slate-900">
                <td className="py-2 text-sm">{field.label}</td>
                <td className="py-">
                  <Switch
                    checked={field.show}
                    onCheckedChange={(show) => {
                      updateQuestion(questionIdx, {
                        [field.id]: {
                          show,
                          required: field.required,
                        },
                      });
                    }}
                  />
                </td>
                <td className="py-2">
                  <Switch
                    checked={field.required}
                    onCheckedChange={(required) => {
                      updateQuestion(questionIdx, {
                        [field.id]: {
                          show: field.show,
                          required,
                        },
                      });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* <AdvancedOptionToggle
          isChecked={question.isAddressLine1Required}
          onToggle={() =>
            updateQuestion(questionIdx, {
              isAddressLine1Required: !question.isAddressLine1Required,
              required: true,
            })
          }
          htmlId="isAddressRequired"
          title="Required: Address Line 1"
          description=""
          childBorder
          customContainerClass="p-0 mt-4"></AdvancedOptionToggle>
        <AdvancedOptionToggle
          isChecked={question.isAddressLine2Required}
          onToggle={() =>
            updateQuestion(questionIdx, {
              isAddressLine2Required: !question.isAddressLine2Required,
              required: true,
            })
          }
          htmlId="isAddressLine2Required"
          title="Required: Address Line 2"
          description=""
          childBorder
          customContainerClass="p-0 mt-4"></AdvancedOptionToggle>
        <AdvancedOptionToggle
          isChecked={question.isCityRequired}
          onToggle={() =>
            updateQuestion(questionIdx, { isCityRequired: !question.isCityRequired, required: true })
          }
          htmlId="isCityRequired"
          title="Required: City / Town"
          description=""
          childBorder
          customContainerClass="p-0 mt-4"></AdvancedOptionToggle>
        <AdvancedOptionToggle
          isChecked={question.isStateRequired}
          onToggle={() =>
            updateQuestion(questionIdx, { isStateRequired: !question.isStateRequired, required: true })
          }
          htmlId="isStateRequired"
          title="Required: State / Region"
          description=""
          childBorder
          customContainerClass="p-0 mt-4"></AdvancedOptionToggle>
        <AdvancedOptionToggle
          isChecked={question.isZipRequired}
          onToggle={() =>
            updateQuestion(questionIdx, { isZipRequired: !question.isZipRequired, required: true })
          }
          htmlId="isZipRequired"
          title="Required: ZIP / Post Code"
          description=""
          childBorder
          customContainerClass="p-0 mt-4"></AdvancedOptionToggle>
        <AdvancedOptionToggle
          isChecked={question.isCountryRequired}
          onToggle={() =>
            updateQuestion(questionIdx, { isCountryRequired: !question.isCountryRequired, required: true })
          }
          htmlId="iscountryRequired"
          title="Required: Country"
          description=""
          childBorder
          customContainerClass="p-0 mt-4"></AdvancedOptionToggle> */}
      </div>
    </form>
  );
};
