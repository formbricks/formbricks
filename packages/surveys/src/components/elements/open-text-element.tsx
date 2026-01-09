import { useState } from "preact/hooks";
import { OpenText } from "@formbricks/survey-ui";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyOpenTextElement } from "@formbricks/types/surveys/elements";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface OpenTextElementProps {
  element: TSurveyOpenTextElement;
  value: string;
  onChange: (responseData: TResponseData) => void;
  autoFocus?: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
  dir?: "ltr" | "rtl" | "auto";
  errorMessage?: string;
}

export function OpenTextElement({
  element,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  currentElementId,
  dir = "auto",
  errorMessage,
}: Readonly<OpenTextElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isCurrent = element.id === currentElementId;
  const isRequired = element.required;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);

  const handleChange = (inputValue: string) => {
    onChange({ [element.id]: inputValue });
  };

  const handleOnSubmit = (e: Event) => {
    e.preventDefault();
    // Update TTC when form is submitted (for TTC collection)
    const updatedTtc = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtc);
  };

  // Map element inputType to OpenText inputType
  const getInputType = (): "text" | "email" | "url" | "phone" | "number" => {
    if (element.inputType === "phone") return "phone";
    if (element.inputType === "email") return "email";
    if (element.inputType === "url") return "url";
    if (element.inputType === "number") return "number";
    return "text";
  };

  return (
    <form key={element.id} onSubmit={handleOnSubmit} className="w-full">
      <OpenText
        elementId={element.id}
        inputId={element.id}
        headline={getLocalizedValue(element.headline, languageCode)}
        description={element.subheader ? getLocalizedValue(element.subheader, languageCode) : undefined}
        placeholder={getLocalizedValue(element.placeholder, languageCode)}
        value={value}
        onChange={handleChange}
        required={isRequired}
        longAnswer={element.longAnswer !== false}
        inputType={getInputType()}
        charLimit={element.inputType === "text" ? element.charLimit : undefined}
        errorMessage={errorMessage}
        dir={dir}
        rows={3}
        imageUrl={element.imageUrl}
        videoUrl={element.videoUrl}
      />
    </form>
  );
}
