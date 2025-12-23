import { useState } from "preact/hooks";
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
  const isCurrent = element.id === currentElementId;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const handleChange = (checked: boolean) => {
    onChange({ [element.id]: checked ? "accepted" : "" });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
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
        dir={dir}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
