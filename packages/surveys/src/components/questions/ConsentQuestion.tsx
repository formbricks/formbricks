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
import type { TSurveyConsentQuestion } from "@formbricks/types/surveys";

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
  isInIframe: boolean;
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
          <div className="bg-survey-bg sticky -bottom-2 z-10 w-full px-1 py-1">
            <label
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
              className="border-border bg-input-bg text-heading hover:bg-input-bg-selected focus:bg-input-bg-selected focus:ring-brand rounded-custom relative z-10 my-2 flex w-full cursor-pointer items-center border p-4 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2">
              <input
                type="checkbox"
                id={question.id}
                name={question.id}
                value={getLocalizedValue(question.label, languageCode)}
                onChange={(e) => {
                  if (e.target instanceof HTMLInputElement && e.target.checked) {
                    onChange({ [question.id]: "accepted" });
                  } else {
                    onChange({ [question.id]: "dismissed" });
                  }
                }}
                checked={value === "accepted"}
                className="border-brand text-brand h-4 w-4 border focus:ring-0 focus:ring-offset-0"
                aria-labelledby={`${question.id}-label`}
                required={question.required}
              />
              <span id={`${question.id}-label`} className="ml-3 font-medium">
                {getLocalizedValue(question.label, languageCode)}
              </span>
            </label>
          </div>
        </div>
      </ScrollableContainer>

      <div className="flex w-full justify-between px-6 py-4">
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
