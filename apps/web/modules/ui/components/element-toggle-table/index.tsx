"use client";

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { TI18nString } from "@formbricks/types/i18n";
import {
  COMPOUND_FIELD_LABELS,
  getCompoundFields,
} from "@formbricks/types/surveys/compound-fields";
import {
  TSurveyAddressElement,
  TSurveyContactInfoElement,
  TSurveyElementTypeEnum,
} from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { TUserLocale } from "@formbricks/types/user";
import { getElementsFromBlocks } from "@/modules/survey/lib/client-utils";
import { ElementFormInput } from "@/modules/survey/components/element-form-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/ui/components/select";
import { Switch } from "@/modules/ui/components/switch";

interface ElementToggleTableProps {
  type: "address" | "contact";
  fields: {
    required: boolean;
    show: boolean;
    id: string;
    label: string;
    placeholder: TI18nString;
    prefillFrom?: string;
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

interface PrefillSource {
  id: string;
  label: string;
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
    field: { id: string; show: boolean; required: boolean; placeholder: TI18nString; prefillFrom?: string },
    show: boolean
  ) => {
    updateElement(elementIdx, {
      [field.id]: {
        show,
        required: field.required,
        placeholder: field.placeholder,
        prefillFrom: field.prefillFrom,
      },
    });
  };

  const onRequiredToggle = (
    field: { id: string; show: boolean; required: boolean; placeholder: TI18nString; prefillFrom?: string },
    required: boolean
  ) => {
    updateElement(elementIdx, {
      [field.id]: {
        show: field.show,
        required,
        placeholder: field.placeholder,
        prefillFrom: field.prefillFrom,
      },
    });
  };

  const onPrefillFromChange = (
    field: { id: string; show: boolean; required: boolean; placeholder: TI18nString; prefillFrom?: string },
    prefillFrom: string | undefined
  ) => {
    updateElement(elementIdx, {
      [field.id]: {
        show: field.show,
        required: field.required,
        placeholder: field.placeholder,
        prefillFrom,
      },
    });
  };

  const allElements = useMemo(() => getElementsFromBlocks(localSurvey.blocks), [localSurvey.blocks]);

  // Get the current element being edited
  const currentElement = allElements[elementIdx];
  const currentElementId = currentElement?.id;

  // Build available pre-fill sources: sub-fields from earlier compound questions + hidden fields
  const prefillSources = useMemo((): PrefillSource[] => {
    const sources: PrefillSource[] = [];
    const currentIdx = allElements.findIndex((e) => e.id === currentElementId);

    // Add sub-fields from earlier compound elements
    for (let i = 0; i < currentIdx; i++) {
      const el = allElements[i];
      const compoundFields = getCompoundFields(el.type);
      if (compoundFields) {
        const headline = el.headline[selectedLanguageCode] || el.id;
        for (const fieldName of compoundFields) {
          const fieldConfig = (el as Record<string, any>)[fieldName];
          if (fieldConfig?.show) {
            sources.push({
              id: `${el.id}.${fieldName}`,
              label: `${headline} > ${COMPOUND_FIELD_LABELS[fieldName] || fieldName}`,
            });
          }
        }
      }
      // Also allow piping from openText questions
      if (el.type === TSurveyElementTypeEnum.OpenText) {
        const headline = el.headline[selectedLanguageCode] || el.id;
        sources.push({ id: el.id, label: headline });
      }
    }

    // Add hidden fields
    if (localSurvey.hiddenFields.fieldIds) {
      for (const fieldId of localSurvey.hiddenFields.fieldIds) {
        sources.push({
          id: fieldId,
          label: `Hidden: ${fieldId}`,
        });
      }
    }

    return sources;
  }, [allElements, currentElementId, localSurvey.hiddenFields, selectedLanguageCode]);

  const { t } = useTranslation();
  return (
    <table className="mt-4 w-full">
      <thead>
        <tr className="text-left text-slate-800">
          <th className="w-1/6 text-sm font-semibold">
            {type === "address"
              ? t("environments.surveys.edit.address_fields")
              : t("environments.surveys.edit.contact_fields")}
          </th>
          <th className="w-16 text-sm font-semibold">{t("common.show")}</th>
          <th className="w-16 text-sm font-semibold">{t("environments.surveys.edit.required")}</th>
          <th className="text-sm font-semibold">{t("common.label")}</th>
          <th className="w-1/4 text-sm font-semibold">Pre-fill from</th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => (
          <tr className="text-slate-900" key={field.id}>
            <td className="py-2 text-sm">{field.label}</td>
            <td className="py-2">
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
            <td className="py-2">
              {field.show && prefillSources.length > 0 ? (
                <Select
                  value={field.prefillFrom || "none"}
                  onValueChange={(val) => onPrefillFromChange(field, val === "none" ? undefined : val)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {prefillSources.map((source) => (
                      <SelectItem key={source.id} value={source.id}>
                        <span className="truncate text-xs">{source.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <span className="text-xs text-slate-400">-</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};
