import { useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { NPS as Nps } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyNPSElement } from "@formbricks/types/surveys/elements";
// Import as Nps to fix sonar issue - "Imported JSX component NPS must be in PascalCase"
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface NPSElementProps {
  element: TSurveyNPSElement;
  value?: number;
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
  dir?: "ltr" | "rtl" | "auto";
}

export function NPSElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  dir = "auto",
}: Readonly<NPSElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const isCurrent = element.id === currentElementId;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);
  const { t } = useTranslation();

  const handleChange = (npsValue: number) => {
    setErrorMessage(undefined);
    onChange({ [element.id]: npsValue });
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  const validateRequired = (): boolean => {
    if (element.required && value === undefined) {
      setErrorMessage(t("errors.please_select_an_option"));
      return false;
    }
    return true;
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    setErrorMessage(undefined);
    if (!validateRequired()) return;
    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  return (
    <form key={element.id} onSubmit={handleSubmit} className="w-full">
      <Nps
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        value={value}
        onChange={handleChange}
        lowerLabel={getLocalizedValue(element.lowerLabel, languageCode)}
        upperLabel={getLocalizedValue(element.upperLabel, languageCode)}
        colorCoding={element.isColorCodingEnabled}
        required={element.required}
        errorMessage={errorMessage}
        dir={dir}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
