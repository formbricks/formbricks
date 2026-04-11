import { useState } from "preact/hooks";
import { FormField, type FormFieldConfig } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyContactInfoElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

const BUILTIN_FIELD_IDS = ["firstName", "lastName", "email", "phone", "company"] as const;
const DEFAULT_FIELD_ORDER = [...BUILTIN_FIELD_IDS];

// Map built-in field IDs to their HTML input types
const BUILTIN_INPUT_TYPES: Record<string, "text" | "email" | "tel"> = {
  email: "email",
  phone: "tel",
};

// Map custom field types to FormField input types
const CUSTOM_TYPE_MAP: Record<string, FormFieldConfig["type"]> = {
  text: "text",
  number: "number",
  date: "date",
  email: "email",
  phone: "tel",
  url: "url",
  dropdown: "dropdown",
};

interface ContactInfoElementProps {
  element: TSurveyContactInfoElement;
  value?: string[] | Record<string, string>;
  onChange: (responseData: TResponseData) => void;
  autoFocus?: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentElementId: string;
  autoFocusEnabled: boolean;
  dir?: "ltr" | "rtl" | "auto";
}

export function ContactInfoElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  dir = "auto",
}: Readonly<ContactInfoElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isCurrent = element.id === currentElementId;

  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  // Normalize incoming value to object format
  const normalizeValue = (raw: string[] | Record<string, string> | undefined): Record<string, string> => {
    if (!raw) return {};
    if (Array.isArray(raw)) {
      // Legacy array format
      return {
        firstName: raw[0] || "",
        lastName: raw[1] || "",
        email: raw[2] || "",
        phone: raw[3] || "",
        company: raw[4] || "",
      };
    }
    return raw;
  };

  const currentValues = normalizeValue(value);

  const handleChange = (newValue: Record<string, string>) => {
    // Always write object format
    onChange({ [element.id]: newValue });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtc = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtc);
  };

  // Determine field order
  const fieldOrder = element.fieldOrder ?? DEFAULT_FIELD_ORDER;

  // Build FormFieldConfig array from fieldOrder
  const formFields: FormFieldConfig[] = fieldOrder
    .map((fieldId): FormFieldConfig | null => {
      // Check if it's a built-in field
      if (BUILTIN_FIELD_IDS.includes(fieldId as (typeof BUILTIN_FIELD_IDS)[number])) {
        const config = element[fieldId as (typeof BUILTIN_FIELD_IDS)[number]];
        if (!config || !config.show) return null;
        return {
          id: fieldId,
          label: getLocalizedValue(config.placeholder, languageCode),
          placeholder: getLocalizedValue(config.placeholder, languageCode),
          required: config.required,
          show: config.show,
          type: BUILTIN_INPUT_TYPES[fieldId] || "text",
        };
      }

      // Check if it's a custom field
      const customField = (element.customFields ?? []).find((cf) => cf.id === fieldId);
      if (!customField || !customField.show) return null;

      const fieldConfig: FormFieldConfig = {
        id: customField.id,
        label: getLocalizedValue(customField.placeholder, languageCode),
        placeholder: getLocalizedValue(customField.placeholder, languageCode),
        required: customField.required,
        show: customField.show,
        type: CUSTOM_TYPE_MAP[customField.type] || "text",
      };

      // Add options for dropdown fields
      if (customField.type === "dropdown" && customField.options) {
        fieldConfig.options = customField.options.map((opt) => ({
          id: opt.id,
          label: getLocalizedValue(opt.label, languageCode),
        }));
      }

      return fieldConfig;
    })
    .filter((f): f is FormFieldConfig => f !== null);

  return (
    <form key={element.id} onSubmit={handleSubmit} className="w-full">
      <FormField
        elementId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        fields={formFields}
        value={currentValues}
        onChange={handleChange}
        required={element.required}
        dir={dir}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
