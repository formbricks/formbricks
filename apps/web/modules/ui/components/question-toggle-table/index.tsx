"use client";

import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { Switch } from "@/modules/ui/components/switch";
import { useTranslate } from "@tolgee/react";
import {
  TI18nString,
  TSurvey,
  TSurveyAddressQuestion,
  TSurveyContactInfoQuestion,
  TSurveyDeployTokenQuestion,
} from "@formbricks/types/surveys/types";

interface QuestionToggleTableProps {
  type: "address" | "contact" | "token";
  fields: {
    required: boolean;
    show: boolean;
    id: string;
    label: string;
    placeholder: TI18nString;
  }[];
  localSurvey: TSurvey;
  questionIdx: number;
  isInvalid: boolean;
  updateQuestion: (
    questionIdx: number,
    updatedAttributes: Partial<TSurveyContactInfoQuestion | TSurveyAddressQuestion | TSurveyDeployTokenQuestion>
  ) => void;
  selectedLanguageCode: string;
}

export const QuestionToggleTable = ({
  type,
  fields,
  localSurvey,
  questionIdx,
  isInvalid,
  updateQuestion,
  selectedLanguageCode,
}: QuestionToggleTableProps) => {
  const onShowToggle = (
    field: { id: string; show: boolean; required: boolean; placeholder: TI18nString },
    show: boolean
  ) => {
    updateQuestion(questionIdx, {
      [field.id]: {
        show,
        required: field.required,
        placeholder: field.placeholder,
      },
    });
  };

  const onRequiredToggle = (
    field: { id: string; show: boolean; required: boolean; placeholder: TI18nString },
    required: boolean
  ) => {
    updateQuestion(questionIdx, {
      [field.id]: {
        show: field.show,
        required,
        placeholder: field.placeholder,
      },
    });
  };

  const { t } = useTranslate();
  return (
    <table className="mt-4 w-full table-fixed">
      <thead>
        <tr className="text-left text-slate-800">
          <th className="w-1/4 text-sm font-semibold">
          {
            (() => {
              switch (type) {
                case "address":
                  return t("environments.surveys.edit.address_fields");
                case "token":
                    return t("environments.surveys.edit.token_fields");
                default:
                  return t("environments.surveys.edit.contact_fields");
              }
            })()
          }
          </th>
          <th className="w-1/6 text-sm font-semibold">{t("common.show")}</th>
          <th className="w-1/6 text-sm font-semibold">{t("environments.surveys.edit.required")}</th>
          <th className="text-sm font-semibold">{t("common.label")}</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => (
          <tr className="text-slate-900" key={field.id}>
            <td className="py-2 text-sm">{field.label}</td>
            <td className="py-">
              <Switch
                checked={field.show}
                onCheckedChange={(show) => {
                  onShowToggle(field, show);
                }}
                disabled={
                  // if all the other fields are hidden, this should be disabled
                  fields.filter((currentField) => currentField.id !== field.id).every((field) => !field.show)
                }
              />
            </td>
            <td className="py-2">
              <Switch
                checked={field.required}
                onCheckedChange={(required) => {
                  onRequiredToggle(field, required);
                }}
                disabled={!field.show}
              />
            </td>
            <td className="py-2">
              <QuestionFormInput
                id={`${field.id}.placeholder`}
                label={""}
                value={field.placeholder}
                localSurvey={localSurvey}
                questionIdx={questionIdx}
                isInvalid={isInvalid}
                updateQuestion={updateQuestion}
                selectedLanguageCode={selectedLanguageCode}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
