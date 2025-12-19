import { useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
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
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);
  const { t } = useTranslation();
  // Convert choices to PictureSelectOption format
  const options: PictureSelectOption[] = element.choices.map((choice) => ({
    id: choice.id,
    imageUrl: choice.imageUrl,
    alt: getOriginalFileNameFromUrl(choice.imageUrl),
  }));

  // Convert value from string[] to string | string[] based on allowMulti
  let currentValue: string | string[];
  if (element.allowMulti) {
    currentValue = value;
  } else if (value.length > 0) {
    currentValue = value[0];
  } else {
    currentValue = "";
  }

  const handleChange = (newValue: string | string[]) => {
    setErrorMessage(undefined);
    let stringArray: string[];
    if (Array.isArray(newValue)) {
      stringArray = newValue;
    } else if (newValue) {
      stringArray = [newValue];
    } else {
      stringArray = [];
    }
    onChange({ [element.id]: stringArray });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (element.required) {
      if (element.allowMulti) {
        console.log("currentValue", currentValue);
        if (!currentValue || !Array.isArray(currentValue) || currentValue.length === 0) {
          setErrorMessage(t("errors.please_select_an_option"));
          return;
        }
      } else {
        if (!currentValue) {
          setErrorMessage(t("errors.please_select_an_option"));
          return;
        }
        const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
      }
    }
  };

  return (
    <form key={element.id} onSubmit={handleSubmit} className="w-full">
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
        errorMessage={errorMessage}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
