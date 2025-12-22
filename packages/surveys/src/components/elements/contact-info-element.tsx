import { useState } from "preact/hooks";
import { FormField, type FormFieldConfig } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyContactInfoElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface ContactInfoElementProps {
  element: TSurveyContactInfoElement;
  value?: string[];
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

  // Convert array value to object for FormField
  const convertToValueObject = (arrayValue: string[] | undefined): Record<string, string> => {
    if (!Array.isArray(arrayValue)) return {};

    const fieldIds = ["firstName", "lastName", "email", "phone", "company"];
    const result: Record<string, string> = {};

    fieldIds.forEach((fieldId, index) => {
      result[fieldId] = arrayValue[index] || "";
    });

    return result;
  };

  // Convert object value back to array for onChange
  const convertToValueArray = (objectValue: Record<string, string>): string[] => {
    const fieldIds = ["firstName", "lastName", "email", "phone", "company"];
    return fieldIds.map((fieldId) => objectValue[fieldId] || "");
  };

  const handleChange = (newValue: Record<string, string>) => {
    onChange({ [element.id]: convertToValueArray(newValue) });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtc = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtc);
  };

  // Convert element fields to FormFieldConfig
  const formFields: FormFieldConfig[] = [
    {
      id: "firstName",
      label: getLocalizedValue(element.firstName.placeholder, languageCode),
      placeholder: getLocalizedValue(element.firstName.placeholder, languageCode),
      required: element.firstName.required,
      show: element.firstName.show,
    },
    {
      id: "lastName",
      label: getLocalizedValue(element.lastName.placeholder, languageCode),
      placeholder: getLocalizedValue(element.lastName.placeholder, languageCode),
      required: element.lastName.required,
      show: element.lastName.show,
    },
    {
      id: "email",
      label: getLocalizedValue(element.email.placeholder, languageCode),
      placeholder: getLocalizedValue(element.email.placeholder, languageCode),
      required: element.email.required,
      show: element.email.show,
      type: "email",
    },
    {
      id: "phone",
      label: getLocalizedValue(element.phone.placeholder, languageCode),
      placeholder: getLocalizedValue(element.phone.placeholder, languageCode),
      required: element.phone.required,
      show: element.phone.show,
      type: "tel",
    },
    {
      id: "company",
      label: getLocalizedValue(element.company.placeholder, languageCode),
      placeholder: getLocalizedValue(element.company.placeholder, languageCode),
      required: element.company.required,
      show: element.company.show,
    },
  ];

  return (
    <form key={element.id} onSubmit={handleSubmit} className="w-full">
      <FormField
        elementId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        fields={formFields}
        value={convertToValueObject(value)}
        onChange={handleChange}
        required={element.required}
        dir={dir}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
