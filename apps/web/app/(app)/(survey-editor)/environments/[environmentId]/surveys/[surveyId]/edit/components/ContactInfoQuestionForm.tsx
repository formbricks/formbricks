"use client";

import { PlusIcon } from "lucide-react";
import { useEffect } from "react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyContactInfoQuestion } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";
import { QuestionToggleTable } from "@formbricks/ui/QuestionToggleTable";

interface ContactInfoQuestionFormProps {
  localSurvey: TSurvey;
  question: TSurveyContactInfoQuestion;
  questionIdx: number;
  updateQuestion: (questionIdx: number, updatedAttributes: Partial<TSurveyContactInfoQuestion>) => void;
  lastQuestion: boolean;
  isInvalid: boolean;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (language: string) => void;
  attributeClasses: TAttributeClass[];
}

export const ContactInfoQuestionForm = ({
  question,
  questionIdx,
  updateQuestion,
  isInvalid,
  localSurvey,
  selectedLanguageCode,
  setSelectedLanguageCode,
  attributeClasses,
}: ContactInfoQuestionFormProps): JSX.Element => {
  const surveyLanguageCodes = extractLanguageCodes(localSurvey.languages ?? []);

  const fields = [
    {
      id: "firstName",
      label: "First Name",
      ...question.firstName,
    },
    {
      id: "lastName",
      label: "Last Name",
      ...question.lastName,
    },
    {
      id: "email",
      label: "Email",
      ...question.email,
    },
    {
      id: "phone",
      label: "Phone",
      ...question.phone,
    },
    {
      id: "company",
      label: "Company",
      ...question.company,
    },
  ];

  useEffect(() => {
    const allFieldsAreOptional = [
      question.firstName,
      question.lastName,
      question.email,
      question.phone,
      question.company,
    ]
      .filter((field) => field.show)
      .every((field) => !field.required);

    if (allFieldsAreOptional) {
      updateQuestion(questionIdx, { required: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.firstName, question.lastName, question.email, question.phone, question.company]);

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

        <QuestionToggleTable
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
