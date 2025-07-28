import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { Headline } from "@/components/general/headline";
import { HtmlBody } from "@/components/general/html-body";
import { QuestionMedia } from "@/components/general/question-media";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { useCallback, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyConsentQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";

interface ConsentQuestionProps {
  question: TSurveyConsentQuestion;
  value: string;
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentQuestionId: TSurveyQuestionId;
  isBackButtonHidden: boolean;
}

export function ConsentQuestion({
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
  currentQuestionId,
  autoFocusEnabled,
  isBackButtonHidden,
}: Readonly<ConsentQuestionProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const isCurrent = question.id === currentQuestionId;

  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  const consentRef = useCallback(
    (currentElement: HTMLLabelElement | null) => {
      // will focus on current element when the question ID matches the current question
      if (question.id && currentElement && autoFocusEnabled && question.id === currentQuestionId) {
        currentElement.focus();
      }
    },
    [question.id, autoFocusEnabled, currentQuestionId]
  );

  return (
    <ScrollableContainer>
      <form
        key={question.id}
        onSubmit={(e) => {
          e.preventDefault();
          const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
          setTtc(updatedTtcObj);
          onSubmit({ [question.id]: value }, updatedTtcObj);
        }}>
        {isMediaAvailable ? <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} /> : null}
        <Headline
          headline={getLocalizedValue(question.headline, languageCode)}
          questionId={question.id}
          required={question.required}
        />
        <HtmlBody
          htmlString={getLocalizedValue(question.html, languageCode) || ""}
          questionId={question.id}
        />
        <label
          ref={consentRef}
          dir="auto"
          tabIndex={isCurrent ? 0 : -1}
          id={`${question.id}-label`}
          onKeyDown={(e) => {
            // Accessibility: if spacebar was pressed pass this down to the input
            if (e.key === " ") {
              e.preventDefault();
              document.getElementById(question.id)?.click();
              document.getElementById(`${question.id}-label`)?.focus();
            }
          }}
          className="fb-border-border fb-bg-input-bg fb-text-heading hover:fb-bg-input-bg-selected focus:fb-bg-input-bg-selected focus:fb-ring-brand fb-rounded-custom fb-relative fb-z-10 fb-my-2 fb-flex fb-w-full fb-cursor-pointer fb-items-center fb-border fb-p-4 fb-text-sm focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2">
          <input
            tabIndex={-1}
            type="checkbox"
            id={question.id}
            name={question.id}
            value={getLocalizedValue(question.label, languageCode)}
            onChange={(e) => {
              if (e.target instanceof HTMLInputElement && e.target.checked) {
                onChange({ [question.id]: "accepted" });
              } else {
                onChange({ [question.id]: "" });
              }
            }}
            checked={value === "accepted"}
            className="fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-border focus:fb-ring-0 focus:fb-ring-offset-0"
            aria-labelledby={`${question.id}-label`}
            required={question.required}
          />
          <span id={`${question.id}-label`} className="fb-ml-3 fb-mr-3 fb-font-medium">
            {getLocalizedValue(question.label, languageCode)}
          </span>
        </label>
        <div className="fb-flex fb-flex-row-reverse fb-w-full fb-justify-between fb-pt-4">
          <SubmitButton
            tabIndex={isCurrent ? 0 : -1}
            buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
            isLastQuestion={isLastQuestion}
          />
          <div />
          {!isFirstQuestion && !isBackButtonHidden && (
            <BackButton
              tabIndex={isCurrent ? 0 : -1}
              backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
              onClick={() => {
                const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                setTtc(updatedTtcObj);
                onBack();
              }}
            />
          )}
        </div>
      </form>
    </ScrollableContainer>
  );
}
