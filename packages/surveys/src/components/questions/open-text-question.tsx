import { type RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyOpenTextQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "../../lib/i18n";
import { getUpdatedTtc, useTtc } from "../../lib/ttc";
import { BackButton } from "../buttons/back-button";
import { SubmitButton } from "../buttons/submit-button";
import { Headline } from "../general/headline";
import { QuestionMedia } from "../general/question-media";
import { Subheader } from "../general/subheader";
import { ScrollableContainer } from "../wrappers/scrollable-container";

interface OpenTextQuestionProps {
  question: TSurveyOpenTextQuestion;
  survey: TJsEnvironmentStateSurvey;
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
  survey,
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
    setCurrentLength(inputValue.length);
    onChange({ [question.id]: inputValue });
  };

  const handleInputResize = (event: { target: any }) => {
    const maxHeight = 160; // 8 lines
    const textarea = event.target;
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflow = newHeight >= maxHeight ? "auto" : "hidden";
  };

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedttc);
        onSubmit({ [question.id]: value }, updatedttc);
      }}
      className="w-full">
      <ScrollableContainer>
        <div>
          {isMediaAvailable ? (
            <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />
          ) : null}
          <Headline
            headline={getLocalizedValue(question.headline, languageCode)}
            headlineColor={survey.styling?.questionColor?.light}
            questionId={question.id}
            required={question.required}
          />
          <Subheader
            subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
            questionId={question.id}
          />
          <div className="mt-4">
            {question.longAnswer === false ? (
              <input
                ref={inputRef as RefObject<HTMLInputElement>}
                autoFocus={isCurrent ? autoFocusEnabled : undefined}
                tabIndex={isCurrent ? 0 : -1}
                name={question.id}
                id={question.id}
                placeholder={getLocalizedValue(question.placeholder, languageCode)}
                dir="auto"
                step="any"
                required={question.required}
                value={value ? value : ""}
                type={question.inputType}
                onInput={(e) => {
                  handleInputChange(e.currentTarget.value);
                }}
                className="border-border placeholder:text-placeholder text-subheading focus:border-brand bg-input-bg rounded-custom block w-full border p-2 shadow-sm focus:outline-none focus:ring-0 sm:text-sm"
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
                dir="auto"
                required={question.required}
                value={value}
                onInput={(e) => {
                  handleInputChange(e.currentTarget.value);
                  handleInputResize(e);
                }}
                className="border-border placeholder:text-placeholder bg-input-bg text-subheading focus:border-brand rounded-custom block w-full border p-2 shadow-sm focus:ring-0 sm:text-sm"
                title={question.inputType === "phone" ? "Please enter a valid phone number" : undefined}
                minLength={question.inputType === "text" ? question.charLimit?.min : undefined}
                maxLength={question.inputType === "text" ? question.charLimit?.max : undefined}
              />
            )}
            {question.inputType === "text" && question.charLimit?.max !== undefined && (
              <span
                className={`text-xs ${currentLength >= question.charLimit?.max ? "font-semibold text-red-500" : "text-neutral-400"}`}>
                {currentLength}/{question.charLimit?.max}
              </span>
            )}
          </div>
        </div>
      </ScrollableContainer>
      <div className="flex w-full flex-row-reverse justify-between px-6 py-4">
        {!isFirstQuestion && !isBackButtonHidden ? (
          <BackButton
            tabIndex={isCurrent ? 0 : -1}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedttc);
              onBack();
            }}
          />
        ) : (
          <div />
        )}
        <div />
        <SubmitButton
          tabIndex={isCurrent ? 0 : -1}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
          onClick={() => {}}
        />
      </div>
    </form>
  );
}
