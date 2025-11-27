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

  const handleOnSubmit = (e: Event) => {
    e.preventDefault();
    const input = inputRef.current;
    input?.setCustomValidity("");

    if (element.required && (!value || value.trim() === "")) {
      input?.setCustomValidity(t("errors.please_fill_out_this_field"));
      input?.reportValidity();
      return;
    }

    if (value && value.trim() !== "") {
      if (element.inputType === "email") {
        if (!ZEmail.safeParse(value).success) {
          input?.setCustomValidity(t("errors.please_enter_a_valid_email_address"));
          input?.reportValidity();
          return;
        }
      } else if (element.inputType === "url") {
        if (!ZUrl.safeParse(value).success) {
          input?.setCustomValidity(t("errors.please_enter_a_valid_url"));
          input?.reportValidity();
          return;
        }
      } else if (element.inputType === "phone") {
        const phoneRegex = /^[+]?[\d\s\-()]{7,}$/;
        if (!phoneRegex.test(value)) {
          input?.setCustomValidity(t("errors.please_enter_a_valid_phone_number"));
          input?.reportValidity();
          return;
        }
      }
    }

    const updatedTtc = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
    setTtc(updatedTtc);
  };

  const computedDir = !value ? dir : "auto";

  return (
    <form key={element.id} onSubmit={handleOnSubmit} className="fb-w-full">
      {isMediaAvailable ? <ElementMedia imgUrl={element.imageUrl} videoUrl={element.videoUrl} /> : null}
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
        {element.longAnswer === false ? (
          <input
            ref={inputRef as RefObject<HTMLInputElement>}
            autoFocus={isCurrent ? autoFocusEnabled : undefined}
            tabIndex={isCurrent ? 0 : -1}
            name={element.id}
            id={element.id}
            placeholder={getLocalizedValue(element.placeholder, languageCode)}
            dir={computedDir}
            step="any"
            required={element.required}
            value={value ? value : ""}
            type={element.inputType}
            onInput={(e) => {
              const input = e.currentTarget;
              handleInputChange(input.value);
              input.setCustomValidity("");
            }}
            className="fb-border-border placeholder:fb-text-placeholder fb-text-subheading focus:fb-border-brand fb-bg-input-bg fb-rounded-custom fb-block fb-w-full fb-border fb-p-2 fb-shadow-sm focus:fb-outline-none focus:fb-ring-0 sm:fb-text-sm"
            pattern={element.inputType === "phone" ? "^[0-9+][0-9+\\- ]*[0-9]$" : ".*"}
            title={
              element.inputType === "phone"
                ? t("errors.please_enter_a_valid_phone_number")
                : element.inputType === "email"
                  ? t("errors.please_enter_a_valid_email_address")
                  : element.inputType === "url"
                    ? t("errors.please_enter_a_valid_url")
                    : undefined
            }
            minLength={element.inputType === "text" ? element.charLimit?.min : undefined}
            maxLength={
              element.inputType === "text"
                ? element.charLimit?.max
                : element.inputType === "phone"
                  ? 30
                  : undefined
            }
          />
        ) : (
          <textarea
            ref={inputRef as RefObject<HTMLTextAreaElement>}
            rows={3}
            autoFocus={isCurrent ? autoFocusEnabled : undefined}
            name={element.id}
            tabIndex={isCurrent ? 0 : -1}
            aria-label="textarea"
            id={element.id}
            placeholder={getLocalizedValue(element.placeholder, languageCode, true)}
            dir={dir}
            required={element.required}
            value={value}
            onInput={(e) => {
              handleInputChange(e.currentTarget.value);
            }}
            className="fb-border-border placeholder:fb-text-placeholder fb-bg-input-bg fb-text-subheading focus:fb-border-brand fb-rounded-custom fb-block fb-w-full fb-border fb-p-2 fb-shadow-sm focus:fb-ring-0 sm:fb-text-sm"
            title={element.inputType === "phone" ? t("errors.please_enter_a_valid_phone_number") : undefined}
            minLength={element.inputType === "text" ? element.charLimit?.min : undefined}
            maxLength={element.inputType === "text" ? element.charLimit?.max : undefined}
          />
        )}
        {element.inputType === "text" && element.charLimit?.max !== undefined && (
          <span
            className={`fb-text-xs ${currentLength >= element.charLimit?.max ? "fb-text-red-500 fb-font-semibold" : "fb-text-neutral-400"}`}>
            {currentLength}/{element.charLimit?.max}
          </span>
        )}
      </div>
    </form>
  );
}
