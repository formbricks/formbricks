"use client";

import { QuestionFormInput } from "@/modules/survey/components/question-form-input";
import { useTranslate } from "@tolgee/react";
import {
  TI18nString,
  TSurvey,
  TSurveyAddressQuestion,
  TSurveyContactInfoQuestion,
  TSurveyDeployTokenQuestion,
} from "@formbricks/types/surveys/types";

interface QuestionTableProps {
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

export const QuestionTable = ({
  type,
  fields,
  localSurvey,
  questionIdx,
  isInvalid,
  updateQuestion,
  selectedLanguageCode,
}: QuestionTableProps) => {
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
          <th className="text-sm font-semibold">{t("common.label")}</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => (
          <tr className="text-slate-900" key={field.id}>
            <td className="py-2 text-sm">{field.label}</td>
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
