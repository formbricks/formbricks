import { type RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { useTranslation } from "react-i18next";
import { ZEmail, ZUrl } from "@formbricks/types/common";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyOpenTextElement } from "@formbricks/types/surveys/elements";
import { Headline } from "@/components/general/headline";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface OpenTextQuestionProps {
  question: TSurveyOpenTextElement;
  value: string;
  onChange: (responseData: TResponseData) => void;
  autoFocus?: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentQuestionId: string;
  dir?: "ltr" | "rtl" | "auto";
}

export function OpenTextQuestion({
  question,
  value,
  onChange,
  languageCode,
  ttc,
  setTtc,
  autoFocusEnabled,
  currentQuestionId,
  dir = "auto",
}: Readonly<OpenTextQuestionProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [currentLength, setCurrentLength] = useState(value.length || 0);
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const isCurrent = question.id === currentQuestionId;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, isCurrent);
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
    onChange({ [question.id]: inputValue });
  };

  const handleOnSubmit = (e: Event) => {
    e.preventDefault();
    const input = inputRef.current;
    input?.setCustomValidity("");

    if (question.required && (!value || value.trim() === "")) {
      input?.setCustomValidity(t("errors.please_fill_out_this_field"));
      input?.reportValidity();
      return;
    }

    if (value && value.trim() !== "") {
      if (question.inputType === "email") {
        if (!ZEmail.safeParse(value).success) {
          input?.setCustomValidity(t("errors.please_enter_a_valid_email_address"));
          input?.reportValidity();
          return;
        }
      } else if (question.inputType === "url") {
        if (!ZUrl.safeParse(value).success) {
          input?.setCustomValidity(t("errors.please_enter_a_valid_url"));
          input?.reportValidity();
          return;
        }
      } else if (question.inputType === "phone") {
        const phoneRegex = /^[+]?[\d\s\-()]{7,}$/;
        if (!phoneRegex.test(value)) {
          input?.setCustomValidity(t("errors.please_enter_a_valid_phone_number"));
          input?.reportValidity();
          return;
        }
      }
    }

    const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtc);
  };

  const computedDir = !value ? dir : "auto";

  return (
    <form key={question.id} onSubmit={handleOnSubmit} className="fb-w-full">
      {isMediaAvailable ? <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} /> : null}
      <Headline
        headline={getLocalizedValue(question.headline, languageCode)}
        questionId={question.id}
        required={question.required}
      />
      <Subheader
        subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
        questionId={question.id}
      />
      <div className="fb-mt-4">
        {question.longAnswer === false ? (
          <input
            ref={inputRef as RefObject<HTMLInputElement>}
            autoFocus={isCurrent ? autoFocusEnabled : undefined}
            tabIndex={isCurrent ? 0 : -1}
            name={question.id}
            id={question.id}
            placeholder={getLocalizedValue(question.placeholder, languageCode)}
            dir={computedDir}
            step="any"
            required={question.required}
            value={value ? value : ""}
            type={question.inputType}
            onInput={(e) => {
              const input = e.currentTarget;
              handleInputChange(input.value);
              input.setCustomValidity("");
            }}
            className="fb-border-border placeholder:fb-text-placeholder fb-text-subheading focus:fb-border-brand fb-bg-input-bg fb-rounded-custom fb-block fb-w-full fb-border fb-p-2 fb-shadow-sm focus:fb-outline-none focus:fb-ring-0 sm:fb-text-sm"
            pattern={question.inputType === "phone" ? "^[0-9+][0-9+\\- ]*[0-9]$" : ".*"}
            title={
              question.inputType === "phone"
                ? t("errors.please_enter_a_valid_phone_number")
                : question.inputType === "email"
                  ? t("errors.please_enter_a_valid_email_address")
                  : question.inputType === "url"
                    ? t("errors.please_enter_a_valid_url")
                    : undefined
            }
            minLength={question.inputType === "text" ? question.charLimit?.min : undefined}
            maxLength={
              question.inputType === "text"
                ? question.charLimit?.max
                : question.inputType === "phone"
                  ? 30
                  : undefined
            }
          />
        ) : (
          <textarea
            ref={inputRef as RefObject<HTMLTextAreaElement>}
            rows={3}
            autoFocus={isCurrent ? autoFocusEnabled : undefined}
            name={question.id}
            tabIndex={isCurrent ? 0 : -1}
            aria-label="textarea"
            id={question.id}
            placeholder={getLocalizedValue(question.placeholder, languageCode, true)}
            dir={dir}
            required={question.required}
            value={value}
            onInput={(e) => {
              handleInputChange(e.currentTarget.value);
            }}
            className="fb-border-border placeholder:fb-text-placeholder fb-bg-input-bg fb-text-subheading focus:fb-border-brand fb-rounded-custom fb-block fb-w-full fb-border fb-p-2 fb-shadow-sm focus:fb-ring-0 sm:fb-text-sm"
            title={question.inputType === "phone" ? t("errors.please_enter_a_valid_phone_number") : undefined}
            minLength={question.inputType === "text" ? question.charLimit?.min : undefined}
            maxLength={question.inputType === "text" ? question.charLimit?.max : undefined}
          />
        )}
        {question.inputType === "text" && question.charLimit?.max !== undefined && (
          <span
            className={`fb-text-xs ${currentLength >= question.charLimit?.max ? "fb-text-red-500 fb-font-semibold" : "fb-text-neutral-400"}`}>
            {currentLength}/{question.charLimit?.max}
          </span>
        )}
      </div>
    </form>
  );
}
