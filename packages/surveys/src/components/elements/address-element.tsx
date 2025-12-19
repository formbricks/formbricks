import { useState } from "preact/hooks";
import { FormField, type FormFieldConfig } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyAddressElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface AddressElementProps {
  element: TSurveyAddressElement;
  value?: string[];
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  currentElementId: string;
  autoFocusEnabled: boolean;
  dir?: "ltr" | "rtl" | "auto";
}

export function AddressElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  dir = "auto",
}: Readonly<AddressElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isCurrent = element.id === currentElementId;

  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  // Convert array value to object for FormField
  const convertToValueObject = (arrayValue: string[] | undefined): Record<string, string> => {
    if (!Array.isArray(arrayValue)) return {};

    const fieldIds = ["addressLine1", "addressLine2", "city", "state", "zip", "country"];
    const result: Record<string, string> = {};

    fieldIds.forEach((fieldId, index) => {
      result[fieldId] = arrayValue[index] || "";
    });

    return result;
  };

  // Convert object value back to array for onChange
  const convertToValueArray = (objectValue: Record<string, string>): string[] => {
    const fieldIds = ["addressLine1", "addressLine2", "city", "state", "zip", "country"];
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
      id: "addressLine1",
      label: element.addressLine1.placeholder[languageCode],
      placeholder: getLocalizedValue(element.addressLine1.placeholder, languageCode),
      required: element.addressLine1.required,
      show: element.addressLine1.show,
    },
    {
      id: "addressLine2",
      label: element.addressLine2.placeholder[languageCode],
      placeholder: getLocalizedValue(element.addressLine2.placeholder, languageCode),
      required: element.addressLine2.required,
      show: element.addressLine2.show,
    },
    {
      id: "city",
      label: element.city.placeholder[languageCode],
      placeholder: getLocalizedValue(element.city.placeholder, languageCode),
      required: element.city.required,
      show: element.city.show,
    },
    {
      id: "state",
      label: element.state.placeholder[languageCode],
      placeholder: getLocalizedValue(element.state.placeholder, languageCode),
      required: element.state.required,
      show: element.state.show,
    },
    {
      id: "zip",
      label: element.zip.placeholder[languageCode],
      placeholder: getLocalizedValue(element.zip.placeholder, languageCode),
      required: element.zip.required,
      show: element.zip.show,
    },
    {
      id: "country",
      label: element.country.placeholder[languageCode],
      placeholder: getLocalizedValue(element.country.placeholder, languageCode),
      required: element.country.required,
      show: element.country.show,
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
