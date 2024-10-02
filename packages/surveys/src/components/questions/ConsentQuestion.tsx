import { BackButton } from "@/components/buttons/BackButton";
import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline";
import { HtmlBody } from "@/components/general/HtmlBody";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { useState } from "preact/hooks";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyConsentQuestion } from "@formbricks/types/surveys/types";

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
  currentQuestionId: string;
}

export const ConsentQuestion = ({
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
}: ConsentQuestionProps) => {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;

  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value }, updatedTtcObj);
      }}>
      <ScrollableContainer>
        <div>
          {isMediaAvailable && <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />}
          <Headline
            headline={getLocalizedValue(question.headline, languageCode)}
            questionId={question.id}
            required={question.required}
          />
          <HtmlBody
            htmlString={getLocalizedValue(question.html, languageCode) || ""}
            questionId={question.id}
          />
          <div className="fb-bg-survey-bg fb-sticky -fb-bottom-2 fb-z-10 fb-w-full fb-px-1 fb-py-1">
            <label
              dir="auto"
              tabIndex={1}
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
          </div>
        </div>
      </ScrollableContainer>

      <div className="fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4">
        {!isFirstQuestion && (
          <BackButton
            tabIndex={3}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onSubmit({ [question.id]: value }, updatedTtcObj);
              onBack();
            }}
          />
        )}
        <div />
        <SubmitButton
          tabIndex={2}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
        />
      </div>
    </form>
  );
};
