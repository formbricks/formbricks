"use client";

import { PlusIcon } from "lucide-react";
import { createI18nString, extractLanguageCodes } from "@formbricks/lib/i18n/utils";
import { TAttributeClass } from "@formbricks/types/attribute-classes";
import { TSurvey, TSurveyContactInfoQuestion } from "@formbricks/types/surveys/types";
import { Button } from "@formbricks/ui/Button";
import { QuestionFormInput } from "@formbricks/ui/QuestionFormInput";
import { Switch } from "@formbricks/ui/Switch";

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
        <div className="mt-2 text-base font-semibold">Settings</div>

        <table className="mt-4 w-1/2 table-fixed">
          <thead>
            <tr className="text-left font-medium text-slate-800">
              <th className="w-1/2 text-sm">Contact Data</th>
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
      </div>
    </form>
  );
};
