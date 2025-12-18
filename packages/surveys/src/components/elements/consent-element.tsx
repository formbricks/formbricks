import { useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { Consent } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyConsentElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface ConsentElementProps {
  element: TSurveyConsentElement;
  value: string;
  onChange: (responseData: TResponseData) => void;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
  dir?: "ltr" | "rtl" | "auto";
}

export function ConsentElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  dir = "auto",
}: Readonly<ConsentElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const isCurrent = element.id === currentElementId;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);
  const { t } = useTranslation();

  const handleChange = (checked: boolean) => {
    setErrorMessage(undefined);
    onChange({ [element.id]: checked ? "accepted" : "" });
  };

  const validateRequired = (): boolean => {
    if (element.required && value !== "accepted") {
      setErrorMessage(t("errors.please_fill_out_this_field"));
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
      <Consent
        elementId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        inputId={element.id}
        checkboxLabel={getLocalizedValue(element.label, languageCode)}
        value={value === "accepted"}
        onChange={handleChange}
        required={element.required}
        errorMessage={errorMessage}
        dir={dir}
      />
    </form>
  );
}
