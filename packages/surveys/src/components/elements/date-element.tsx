import { useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { DateElement as SurveyUIDateElement } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyDateElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface DateElementProps {
  element: TSurveyDateElement;
  value: string;
  onChange: (responseData: TResponseData) => void;
  autoFocus?: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
}

export function DateElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
}: Readonly<DateElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const isCurrent = element.id === currentElementId;

  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);
  const { t } = useTranslation();

  const handleChange = (dateValue: string) => {
    // Clear error when user selects a date
    setErrorMessage(undefined);
    onChange({ [element.id]: dateValue });
  };

  const validateRequired = (): boolean => {
    if (element.required && (!value || value.trim() === "")) {
      setErrorMessage(t("errors.please_select_a_date"));
      return false;
    }
    return true;
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    if (!validateRequired()) return;

    const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
  };

  const getMinDate = (): string | undefined => {
    return new Date(new Date().getFullYear() - 100, 0, 1).toISOString().split("T")[0];
  };

  const getMaxDate = (): string | undefined => {
    return new Date(new Date().getFullYear() + 100, 0, 1).toISOString().split("T")[0];
  };

  return (
    <form key={element.id} onSubmit={handleSubmit} className="w-full">
      <SurveyUIDateElement
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        value={value}
        onChange={handleChange}
        minDate={getMinDate()}
        maxDate={getMaxDate()}
        required={element.required}
        errorMessage={errorMessage}
        locale={languageCode}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
