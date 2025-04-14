import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { Headline } from "@/components/general/headline";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
import { useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyNPSQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";

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
  autoFocusEnabled: boolean;
  currentQuestionId: TSurveyQuestionId;
  isBackButtonHidden: boolean;
}

export function NPSQuestion({
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
  isBackButtonHidden,
}: NPSQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());
  const [hoveredNumber, setHoveredNumber] = useState(-1);
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const isCurrent = question.id === currentQuestionId;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  const handleClick = (number: number) => {
    onChange({ [question.id]: number });
    const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtcObj);
    setTimeout(() => {
      onSubmit(
        {
          [question.id]: number,
        },
        updatedTtcObj
      );
    }, 250);
  };

  const getNPSOptionColor = (idx: number) => {
    if (idx > 8) return "fb:bg-emerald-100";
    if (idx > 6) return "fb:bg-orange-100";
    return "fb:bg-rose-100";
  };

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value ?? "" }, updatedTtcObj);
      }}>
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
          <div className="fb:my-4">
            <fieldset>
              <legend className="fb:sr-only">Options</legend>
              <div className="fb:flex">
                {Array.from({ length: 11 }, (_, i) => i).map((number, idx) => {
                  return (
                    <label
                      key={number}
                      tabIndex={isCurrent ? 0 : -1}
                      onMouseOver={() => {
                        setHoveredNumber(number);
                      }}
                      onMouseLeave={() => {
                        setHoveredNumber(-1);
                      }}
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
                          ? "fb:border-border-highlight fb:bg-accent-selected-bg fb:z-10 fb:border"
                          : "fb:border-border",
                        "fb:text-heading fb:first:rounded-l-custom fb:last:rounded-r-custom fb:focus:border-brand fb:relative fb:h-10 fb:flex-1 fb:cursor-pointer fb:overflow-hidden fb:border-b fb:border-l fb:border-t fb:text-center fb:text-sm fb:last:border-r fb:focus:border-2 fb:focus:outline-hidden",
                        question.isColorCodingEnabled
                          ? "fb:h-[46px] fb:leading-[3.5em]"
                          : "fb:h fb:leading-10",
                        hoveredNumber === number ? "fb:bg-accent-bg" : ""
                      )}>
                      {question.isColorCodingEnabled ? (
                        <div
                          className={`fb:absolute fb:left-0 fb:top-0 fb:h-[6px] fb:w-full ${getNPSOptionColor(idx)}`}
                        />
                      ) : null}
                      <input
                        type="radio"
                        id={number.toString()}
                        name="nps"
                        value={number}
                        checked={value === number}
                        className="fb:absolute fb:left-0 fb:h-full fb:w-full fb:cursor-pointer fb:opacity-0"
                        onClick={() => {
                          handleClick(number);
                        }}
                        required={question.required}
                        tabIndex={-1}
                      />
                      {number}
                    </label>
                  );
                })}
              </div>
              <div className="fb:text-subheading fb:mt-2 fb:flex fb:justify-between fb:px-1.5 fb:text-xs fb:leading-6 fb:space-x-8">
                <p dir="auto">{getLocalizedValue(question.lowerLabel, languageCode)}</p>
                <p dir="auto">{getLocalizedValue(question.upperLabel, languageCode)}</p>
              </div>
            </fieldset>
          </div>
        </div>
      </ScrollableContainer>
      <div className="fb:flex fb:flex-row-reverse fb:w-full fb:justify-between fb:px-6 fb:py-4">
        {question.required ? (
          <div></div>
        ) : (
          <SubmitButton
            tabIndex={isCurrent ? 0 : -1}
            buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
            isLastQuestion={isLastQuestion}
          />
        )}
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
  );
}
