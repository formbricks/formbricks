import { BackButton } from "@/components/buttons/BackButton";
import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import { Subheader } from "@/components/general/Subheader";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { useState } from "preact/hooks";
import { useCallback } from "react";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData } from "@formbricks/types/responses";
import { TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyOpenTextQuestion } from "@formbricks/types/surveys/types";

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
  currentQuestionId: string;
}

export const OpenTextQuestion = ({
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
}: OpenTextQuestionProps) => {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;

  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  const handleInputChange = (inputValue: string) => {
    onChange({ [question.id]: inputValue });
  };

  const handleInputResize = (event: { target: any }) => {
    let maxHeight = 160; // 8 lines
    const textarea = event.target;
    textarea.style.height = "auto";
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflow = newHeight >= maxHeight ? "auto" : "hidden";
  };

  const openTextRef = useCallback(
    (currentElement: HTMLInputElement | HTMLTextAreaElement | null) => {
      if (question.id && currentElement && autoFocusEnabled) {
        currentElement.focus();
      }
    },
    [question.id, autoFocusEnabled]
  );

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedttc);
        onSubmit({ [question.id]: value }, updatedttc);
      }}
      className="fb-w-full">
      <ScrollableContainer>
        <div>
          {isMediaAvailable && <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />}
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
                ref={openTextRef}
                tabIndex={1}
                name={question.id}
                id={question.id}
                placeholder={getLocalizedValue(question.placeholder, languageCode)}
                dir="auto"
                step={"any"}
                required={question.required}
                value={value ? (value as string) : ""}
                type={question.inputType}
                onInput={(e) => handleInputChange(e.currentTarget.value)}
                autoFocus={autoFocusEnabled}
                className="fb-border-border placeholder:fb-text-placeholder fb-text-subheading focus:fb-border-brand fb-bg-input-bg fb-rounded-custom fb-block fb-w-full fb-border fb-p-2 fb-shadow-sm focus:fb-outline-none focus:fb-ring-0 sm:fb-text-sm"
                pattern={question.inputType === "phone" ? "[0-9+ ]+" : ".*"}
                title={question.inputType === "phone" ? "Enter a valid phone number" : undefined}
              />
            ) : (
              <textarea
                ref={openTextRef}
                rows={3}
                name={question.id}
                tabIndex={1}
                aria-label="textarea"
                id={question.id}
                placeholder={getLocalizedValue(question.placeholder, languageCode)}
                dir="auto"
                required={question.required}
                value={value as string}
                type={question.inputType}
                onInput={(e) => {
                  handleInputChange(e.currentTarget.value);
                  handleInputResize(e);
                }}
                autoFocus={autoFocusEnabled}
                className="fb-border-border placeholder:fb-text-placeholder fb-bg-input-bg fb-text-subheading focus:fb-border-brand fb-rounded-custom fb-block fb-w-full fb-border fb-p-2 fb-shadow-sm focus:fb-ring-0 sm:fb-text-sm"
                pattern={question.inputType === "phone" ? "[+][0-9 ]+" : ".*"}
                title={question.inputType === "phone" ? "Please enter a valid phone number" : undefined}
              />
            )}
          </div>
        </div>
      </ScrollableContainer>
      <div className="fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4">
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedttc);
              onBack();
            }}
          />
        )}
        <div></div>
        <SubmitButton
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
          onClick={() => {}}
        />
      </div>
    </form>
  );
};
