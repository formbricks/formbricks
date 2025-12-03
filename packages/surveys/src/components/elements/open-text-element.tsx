import { type RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { ZEmail, ZUrl } from "@formbricks/types/common";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyOpenTextElement } from "@formbricks/types/surveys/elements";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { Subheader } from "@/components/general/subheader";
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
  autoFocusEnabled,
  currentElementId,
  dir = "auto",
}: Readonly<OpenTextElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [currentLength, setCurrentLength] = useState(value.length || 0);
  const isMediaAvailable = element.imageUrl || element.videoUrl;
  const isCurrent = element.id === currentElementId;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, isCurrent);
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isCurrent && autoFocusEnabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCurrent, autoFocusEnabled]);

  const handleInputChange = (inputValue: string) => {
    inputRef.current?.setCustomValidity("");
    setCurrentLength(inputValue.length);
    onChange({ [element.id]: inputValue });
  };

  const validateRequired = (input: HTMLInputElement | HTMLTextAreaElement | null): boolean => {
    if (element.required && (!value || value.trim() === "")) {
      input?.setCustomValidity(t("errors.please_fill_out_this_field"));
      input?.reportValidity();
      return false;
    }
    return true;
  };

  const validateEmail = (input: HTMLInputElement | HTMLTextAreaElement | null): boolean => {
    if (!ZEmail.safeParse(value).success) {
      input?.setCustomValidity(t("errors.please_enter_a_valid_email_address"));
      input?.reportValidity();
      return false;
    }
    return true;
  };

  const validateUrl = (input: HTMLInputElement | HTMLTextAreaElement | null): boolean => {
    if (!ZUrl.safeParse(value).success) {
      input?.setCustomValidity(t("errors.please_enter_a_valid_url"));
      input?.reportValidity();
      return false;
    }
    return true;
  };

  const validatePhone = (input: HTMLInputElement | HTMLTextAreaElement | null): boolean => {
    // Match the same pattern as getInputPattern: must start with digit or +, end with digit
    // Allows digits, +, -, and spaces in between
    const phoneRegex = /^[0-9+][0-9+\- ]*[0-9]$/;
    if (!phoneRegex.test(value)) {
      input?.setCustomValidity(t("errors.please_enter_a_valid_phone_number"));
      input?.reportValidity();
      return false;
    }
    return true;
  };

  const validateInput = (input: HTMLInputElement | HTMLTextAreaElement | null): boolean => {
    if (!value || value.trim() === "") return true;

    if (element.inputType === "email") {
      return validateEmail(input);
    }
    if (element.inputType === "url") {
      return validateUrl(input);
    }
    if (element.inputType === "phone") {
      return validatePhone(input);
    }
    return true;
  };

  const handleOnSubmit = (e: Event) => {
    e.preventDefault();
    const input = inputRef.current;
    input?.setCustomValidity("");

    if (!validateRequired(input)) return;
    if (!validateInput(input)) return;

    const updatedTtc = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtc);
  };

  const getInputTitle = (): string | undefined => {
    if (element.inputType === "phone") return t("errors.please_enter_a_valid_phone_number");
    if (element.inputType === "email") return t("errors.please_enter_a_valid_email_address");
    if (element.inputType === "url") return t("errors.please_enter_a_valid_url");
    return undefined;
  };

  const getInputPattern = (): string => {
    return element.inputType === "phone" ? "^[0-9+][0-9+\\- ]*[0-9]$" : ".*";
  };

  const getInputMinLength = (): number | undefined => {
    return element.inputType === "text" ? element.charLimit?.min : undefined;
  };

  const getInputMaxLength = (): number | undefined => {
    if (element.inputType === "text") return element.charLimit?.max;
    if (element.inputType === "phone") return 30;
    return undefined;
  };

  const handleInputOnInput = (e: Event) => {
    const input = e.currentTarget as HTMLInputElement;
    handleInputChange(input.value);
    input.setCustomValidity("");
  };

  const handleTextareaOnInput = (e: Event) => {
    const textarea = e.currentTarget as HTMLTextAreaElement;
    handleInputChange(textarea.value);
  };

  const renderCharLimit = () => {
    if (element.inputType !== "text" || element.charLimit?.max === undefined) return null;
    const isOverLimit = currentLength >= element.charLimit.max;
    const className = `fb-text-xs ${isOverLimit ? "fb-text-red-500 fb-font-semibold" : "fb-text-neutral-400"}`;
    return (
      <span className={className}>
        {currentLength}/{element.charLimit.max}
      </span>
    );
  };

  const renderInput = () => {
    const computedDir = !value ? dir : "auto";
    return (
      <input
        ref={inputRef as RefObject<HTMLInputElement>}
        autoFocus={isCurrent ? autoFocusEnabled : undefined}
        tabIndex={0}
        name={element.id}
        id={element.id}
        placeholder={getLocalizedValue(element.placeholder, languageCode)}
        dir={computedDir}
        step="any"
        required={element.required}
        value={value || ""}
        type={element.inputType}
        onInput={handleInputOnInput}
        className="fb-border-border placeholder:fb-text-placeholder fb-text-subheading focus:fb-border-brand fb-bg-input-bg fb-rounded-custom fb-block fb-w-full fb-border fb-p-2 fb-shadow-sm focus:fb-outline-none focus:fb-ring-0 sm:fb-text-sm"
        pattern={getInputPattern()}
        title={getInputTitle()}
        minLength={getInputMinLength()}
        maxLength={getInputMaxLength()}
      />
    );
  };

  const renderTextarea = () => {
    return (
      <textarea
        ref={inputRef as RefObject<HTMLTextAreaElement>}
        rows={3}
        autoFocus={isCurrent ? autoFocusEnabled : undefined}
        name={element.id}
        tabIndex={0}
        aria-label="textarea"
        id={element.id}
        placeholder={getLocalizedValue(element.placeholder, languageCode, true)}
        dir={dir}
        required={element.required}
        value={value}
        onInput={handleTextareaOnInput}
        className="fb-border-border placeholder:fb-text-placeholder fb-bg-input-bg fb-text-subheading focus:fb-border-brand fb-rounded-custom fb-block fb-w-full fb-border fb-p-2 fb-shadow-sm focus:fb-ring-0 sm:fb-text-sm"
        minLength={getInputMinLength()}
        maxLength={getInputMaxLength()}
      />
    );
  };

  return (
    <form key={element.id} onSubmit={handleOnSubmit} className="fb-w-full">
      {isMediaAvailable && <ElementMedia imgUrl={element.imageUrl} videoUrl={element.videoUrl} />}
      <Headline
        headline={getLocalizedValue(element.headline, languageCode)}
        elementId={element.id}
        required={element.required}
      />
      <Subheader
        subheader={element.subheader ? getLocalizedValue(element.subheader, languageCode) : ""}
        elementId={element.id}
      />
      <div className="fb-mt-4">
        {element.longAnswer === false ? renderInput() : renderTextarea()}
        {renderCharLimit()}
      </div>
    </form>
  );
}
