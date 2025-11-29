"use client";

import { useTranslation } from "react-i18next";
import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyAddressElement, TSurveyContactInfoElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import { Switch } from "@/modules/ui/components/switch";

interface ElementToggleTableProps {
  type: "address" | "contact";
  fields: {
    required: boolean;
    show: boolean;
    id: string;
    label: string;
    placeholder: TI18nString;
  }[];
  localSurvey: TSurvey;
  elementIdx: number;
  isInvalid: boolean;
  updateElement: (
    elementIdx: number,
    updatedAttributes: Partial<TSurveyContactInfoElement | TSurveyAddressElement>
  ) => void;
  selectedLanguageCode: string;
  setSelectedLanguageCode: (languageCode: string) => void;
  locale: TUserLocale;
  isStorageConfigured: boolean;
}

export const ElementToggleTable = ({
  type,
  fields,
  localSurvey,
  elementIdx,
  isInvalid,
  updateElement,
  selectedLanguageCode,
  setSelectedLanguageCode,
  locale,
  isStorageConfigured,
}: ElementToggleTableProps) => {
  const onShowToggle = (
    field: { id: string; show: boolean; required: boolean; placeholder: TI18nString },
    show: boolean
  ) => {
    updateElement(elementIdx, {
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
    updateElement(elementIdx, {
      [field.id]: {
        show: field.show,
        required,
        placeholder: field.placeholder,
      },
    });
  };

  const { t } = useTranslation();
  return (
    <table className="mt-4 w-full table-fixed">
      <thead>
        <tr className="text-left text-slate-800">
          <th className="w-1/4 text-sm font-semibold">
            {type === "address"
              ? t("environments.surveys.edit.address_fields")
              : t("environments.surveys.edit.contact_fields")}
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
              <ElementFormInput
                id={`${field.id}.placeholder`}
                label={""}
                value={field.placeholder}
                localSurvey={localSurvey}
                elementIdx={elementIdx}
                isInvalid={isInvalid}
                updateElement={updateElement}
                selectedLanguageCode={selectedLanguageCode}
                setSelectedLanguageCode={setSelectedLanguageCode}
                locale={locale}
                isStorageConfigured={isStorageConfigured}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
