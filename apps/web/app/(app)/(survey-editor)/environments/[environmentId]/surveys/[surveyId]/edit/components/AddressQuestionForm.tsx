"use client";

import { PlusIcon } from "lucide-react";
import { useEffect } from "react";
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

  useEffect(() => {
    const allFieldsAreOptional = [
      question.addressLine1,
      question.addressLine2,
      question.city,
      question.state,
      question.zip,
      question.country,
    ]
      .filter((field) => field.show)
      .every((field) => !field.required);

    if (allFieldsAreOptional) {
      updateQuestion(questionIdx, { required: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    question.addressLine1,
    question.addressLine2,
    question.city,
    question.state,
    question.zip,
    question.country,
  ]);

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
                        // when show changes, and the field is required, the question should be required
                        ...(show && field.required && { required: true }),
                      });
                    }}
                    disabled={
                      // if all the other fields are hidden, this should be disabled
                      fields
                        .filter((currentField) => currentField.id !== field.id)
                        .every((field) => !field.show)
                    }
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
                        required: true,
                      });
                    }}
                    disabled={!field.show}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </form>
  );
};
