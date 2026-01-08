import { useState } from "preact/hooks";
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
  errorMessage?: string;
}

export function DateElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  errorMessage,
}: Readonly<DateElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isCurrent = element.id === currentElementId;
  const isRequired = element.validationRules?.some((rule) => rule.type === "required") ?? false;

  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const handleChange = (dateValue: string) => {
    onChange({ [element.id]: dateValue });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    // Update TTC when form is submitted (for TTC collection)
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
        required={isRequired}
        errorMessage={errorMessage}
        locale={languageCode}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
