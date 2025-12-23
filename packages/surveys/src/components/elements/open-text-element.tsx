import { useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { OpenText } from "@formbricks/survey-ui";
import { ZEmail, ZUrl } from "@formbricks/types/common";
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
}: Readonly<OpenTextElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [errorMessage, setErrorMessage] = useState<string | undefined>(undefined);
  const isCurrent = element.id === currentElementId;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);
  const { t } = useTranslation();

  const handleChange = (inputValue: string) => {
    // Clear error when user starts typing
    setErrorMessage(undefined);
    onChange({ [element.id]: inputValue });
  };

  const validateRequired = (): boolean => {
    if (element.required && (!value || value.trim() === "")) {
      setErrorMessage(t("errors.please_fill_out_this_field"));
      return false;
    }
    return true;
  };

  const validateEmail = (): boolean => {
    if (!ZEmail.safeParse(value).success) {
      setErrorMessage(t("errors.please_enter_a_valid_email_address"));
      return false;
    }
    return true;
  };

  const validateUrl = (): boolean => {
    if (!ZUrl.safeParse(value).success) {
      setErrorMessage(t("errors.please_enter_a_valid_url"));
      return false;
    }
    return true;
  };

  const validatePhone = (): boolean => {
    // Match the same pattern: must start with digit or +, end with digit
    // Allows digits, +, -, and spaces in between
    const phoneRegex = /^[0-9+][0-9+\- ]*[0-9]$/;
    if (!phoneRegex.test(value)) {
      setErrorMessage(t("errors.please_enter_a_valid_phone_number"));
      return false;
    }
    return true;
  };

  const validateInput = (): boolean => {
    if (!value || value.trim() === "") return true;

    if (element.inputType === "email") {
      return validateEmail();
    }
    if (element.inputType === "url") {
      return validateUrl();
    }
    if (element.inputType === "phone") {
      return validatePhone();
    }
    return true;
  };

  const handleOnSubmit = (e: Event) => {
    e.preventDefault();
    setErrorMessage(undefined);

    if (!validateRequired()) return;
    if (!validateInput()) return;

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
        required={element.required}
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
