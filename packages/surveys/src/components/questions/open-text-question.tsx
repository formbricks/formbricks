import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { Headline } from "@/components/general/headline";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { isRTL } from "@/lib/utils";
import { type RefObject } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyOpenTextQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface OpenTextQuestionProps {
  question: TSurveyOpenTextQuestion;
  value: string;
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  autoFocus?: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentQuestionId: TSurveyQuestionId;
  isBackButtonHidden: boolean;
}

export function OpenTextQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  languageCode,
  ttc,
  setTtc,
  autoFocusEnabled,
  currentQuestionId,
  isBackButtonHidden,
}: OpenTextQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());
  const [currentLength, setCurrentLength] = useState(value.length || 0);
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const isCurrent = question.id === currentQuestionId;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, isCurrent);

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
      input?.setCustomValidity("Please fill out this field.");
      input?.reportValidity();
      return;
    }

    // at this point, validity is clean
    const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtc);
    onSubmit({ [question.id]: value }, updatedTtc);
  };

  const dir = useMemo(() => {
    const placeholder = getLocalizedValue(question.placeholder, languageCode);
    if (!value) return isRTL(placeholder) ? "rtl" : "ltr";
    return "auto";
  }, [value, languageCode, question.placeholder]);

  return (
    <form key={question.id} onSubmit={handleOnSubmit} className="fb-w-full">
      <ScrollableContainer>
        <div>
          {isMediaAvailable ? (
            <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />
          ) : null}
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
                dir={dir}
                step="any"
                required={question.required}
                value={value ? value : ""}
                type={question.inputType}
                onInput={(e) => {
                  handleInputChange(e.currentTarget.value);
                }}
                className="fb-border-border placeholder:fb-text-placeholder fb-text-subheading focus:fb-border-brand fb-bg-input-bg fb-rounded-custom fb-block fb-w-full fb-border fb-p-2 fb-shadow-sm focus:fb-outline-none focus:fb-ring-0 sm:fb-text-sm"
                pattern={question.inputType === "phone" ? "^[0-9+][0-9+\\- ]*[0-9]$" : ".*"}
                title={question.inputType === "phone" ? "Enter a valid phone number" : undefined}
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
                placeholder={getLocalizedValue(question.placeholder, languageCode)}
                dir={dir}
                required={question.required}
                value={value}
                onInput={(e) => {
                  handleInputChange(e.currentTarget.value);
                }}
                className="fb-border-border placeholder:fb-text-placeholder fb-bg-input-bg fb-text-subheading focus:fb-border-brand fb-rounded-custom fb-block fb-w-full fb-border fb-p-2 fb-shadow-sm focus:fb-ring-0 sm:fb-text-sm"
                title={question.inputType === "phone" ? "Please enter a valid phone number" : undefined}
                minLength={question.inputType === "text" ? question.charLimit?.min : undefined}
                maxLength={question.inputType === "text" ? question.charLimit?.max : undefined}
              />
            )}
            {question.inputType === "text" && question.charLimit?.max !== undefined && (
              <span
                className={`fb-text-xs ${currentLength >= question.charLimit?.max ? "fb-text-red-500 font-semibold" : "text-neutral-400"}`}>
                {currentLength}/{question.charLimit?.max}
              </span>
            )}
          </div>
        </div>
      </ScrollableContainer>
      <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-between fb-px-6 fb-py-4">
        <SubmitButton
          tabIndex={isCurrent ? 0 : -1}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
          onClick={() => {}}
        />
        {!isFirstQuestion && !isBackButtonHidden && (
          <BackButton
            tabIndex={isCurrent ? 0 : -1}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedttc);
              onBack();
            }}
          />
        )}
      </div>
    </form>
  );
}
