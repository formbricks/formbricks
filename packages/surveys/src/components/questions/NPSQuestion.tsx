import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import Subheader from "@/components/general/Subheader";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
import { useState } from "preact/hooks";

import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyNPSQuestion } from "@formbricks/types/surveys";

interface NPSQuestionProps {
  question: TSurveyNPSQuestion;
  value?: number;
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  isInIframe: boolean;
}

export const NPSQuestion = ({
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
}: NPSQuestionProps) => {
  const [startTime, setStartTime] = useState(performance.now());
  const [hoveredNumber, setHoveredNumber] = useState(-1);
  const isMediaAvailable = question.imageUrl || question.videoUrl;

  useTtc(question.id, ttc, setTtc, startTime, setStartTime);

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value ?? "" }, updatedTtcObj);
      }}>
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
      <div className="my-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div className="flex">
            {Array.from({ length: 11 }, (_, i) => i).map((number, idx) => {
              return (
                <label
                  key={number}
                  tabIndex={idx + 1}
                  onMouseOver={() => setHoveredNumber(number)}
                  onMouseLeave={() => setHoveredNumber(-1)}
                  onKeyDown={(e) => {
                    // Accessibility: if spacebar was pressed pass this down to the input
                    if (e.key === " ") {
                      e.preventDefault();
                      document.getElementById(number.toString())?.click();
                      document.getElementById(number.toString())?.focus();
                    }
                  }}
                  className={cn(
                    value === number
                      ? "border-border-highlight bg-accent-selected-bg z-10 border"
                      : "border-border",
                    "text-heading first:rounded-l-custom last:rounded-r-custom focus:border-brand relative h-10 flex-1 cursor-pointer border-b border-l border-t text-center text-sm leading-10 last:border-r focus:border-2 focus:outline-none",
                    hoveredNumber === number ? "bg-accent-bg" : ""
                  )}>
                  <input
                    type="radio"
                    id={number.toString()}
                    name="nps"
                    value={number}
                    checked={value === number}
                    className="absolute h-full w-full cursor-pointer opacity-0"
                    onClick={() => {
                      const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                      setTtc(updatedTtcObj);
                      onSubmit(
                        {
                          [question.id]: number,
                        },
                        updatedTtcObj
                      );
                      onChange({ [question.id]: number });
                    }}
                    required={question.required}
                  />
                  {number}
                </label>
              );
            })}
          </div>
          <div className="text-subheading mt-2 flex justify-between px-1.5 text-xs leading-6">
            <p>{getLocalizedValue(question.lowerLabel, languageCode)}</p>
            <p>{getLocalizedValue(question.upperLabel, languageCode)}</p>
          </div>
        </fieldset>
      </div>
      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            tabIndex={isLastQuestion ? 12 : 13}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onBack();
            }}
          />
        )}
        <div></div>
        {!question.required && (
          <SubmitButton
            tabIndex={12}
            buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
            isLastQuestion={isLastQuestion}
          />
        )}
      </div>
    </form>
  );
};
