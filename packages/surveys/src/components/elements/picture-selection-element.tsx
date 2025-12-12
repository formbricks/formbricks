import { useState } from "preact/hooks";
import { PictureSelect, type PictureSelectOption } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyPictureSelectionElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { getOriginalFileNameFromUrl } from "@/lib/storage";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface PictureSelectionProps {
  element: TSurveyPictureSelectionElement;
  value: string[];
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
  dir?: "ltr" | "rtl" | "auto";
}

export function PictureSelectionElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  dir = "auto",
}: Readonly<PictureSelectionProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isCurrent = element.id === currentElementId;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  // Convert choices to PictureSelectOption format
  const options: PictureSelectOption[] = element.choices.map((choice) => ({
    id: choice.id,
    imageUrl: choice.imageUrl,
    alt: getOriginalFileNameFromUrl(choice.imageUrl),
  }));

  // Convert value from string[] to string | string[] based on allowMulti
  const currentValue: string | string[] = element.allowMulti ? value : value.length > 0 ? value[0] : "";

  const handleChange = (newValue: string | string[]) => {
    const stringArray = Array.isArray(newValue) ? newValue : newValue ? [newValue] : [];
    onChange({ [element.id]: stringArray });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  return (
    <form key={element.id} onSubmit={handleSubmit} className="fb:w-full">
      <PictureSelect
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        options={options}
        value={currentValue}
        onChange={handleChange}
        allowMulti={element.allowMulti}
        required={element.required}
        dir={dir}
      />
    </form>
  );
}
