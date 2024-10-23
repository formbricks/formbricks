"use client";

import { PlusIcon } from "lucide-react";
import { useEffect } from "react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-keys";
import { TSurvey, TSurveyAddressQuestion } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/components/Button";
import { QuestionFormInput } from "@formbricks/ui/components/QuestionFormInput";
import { QuestionToggleTable } from "@formbricks/ui/components/QuestionToggleTable";

interface AddressQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyAddressQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyAddressQuestion>) => void;
  lastQuestion: boolean;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  contactAttributeKeys: TContactAttributeKey[];
}

export const AddressQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  contactAttributeKeys,
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
        contactAttributeKeys={contactAttributeKeys}
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
                contactAttributeKeys={contactAttributeKeys}
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

        <QuestionToggleTable
          type="address"
          fields={fields}
          onShowToggle={(field, show) => {
            updateQuestion(questionIdx, {
              [field.id]: {
                show,
                required: field.required,
              },
              // when show changes, and the field is required, the question should be required
              ...(show && field.required && { required: true }),
            });
          }}
          onRequiredToggle={(field, required) => {
            updateQuestion(questionIdx, {
              [field.id]: {
                show: field.show,
                required,
              },
              required: true,
            });
          }}
        />
      </div>
    </form>
  );
};
