import { useCallback, useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyConsentQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { Headline } from "@/components/general/headline";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";

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
  dir?: "ltr" | "rtl" | "auto";
  fullSizeCards: boolean;
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
  dir = "auto",
  fullSizeCards,
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
    <ScrollableContainer fullSizeCards={fullSizeCards}>
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
        <Subheader
          subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
          questionId={question.id}
        />
        <label
          ref={consentRef}
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
          className="border-border bg-input-bg text-heading hover:bg-input-bg-selected focus:bg-input-bg-selected focus:ring-brand rounded-custom relative z-10 my-2 flex w-full cursor-pointer items-center border p-4 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2">
          <input
            tabIndex={-1}
            type="checkbox"
            dir={dir}
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
            className="border-brand text-brand h-4 w-4 border focus:ring-0 focus:ring-offset-0"
            aria-labelledby={`${question.id}-label`}
            required={question.required}
          />
          <span id={`${question.id}-label`} className="ml-3 mr-3 flex-1 font-medium" dir="auto">
            {getLocalizedValue(question.label, languageCode)}
          </span>
        </label>
        <div className="flex w-full flex-row-reverse justify-between pt-4">
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
