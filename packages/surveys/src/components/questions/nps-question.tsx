import { useState } from "preact/hooks";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyNPSQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { BackButton } from "@/components/buttons/back-button";
import { SubmitButton } from "@/components/buttons/submit-button";
import { Headline } from "@/components/general/headline";
import { QuestionMedia } from "@/components/general/question-media";
import { Subheader } from "@/components/general/subheader";
import { ScrollableContainer } from "@/components/wrappers/scrollable-container";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";

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
  dir?: "ltr" | "rtl" | "auto";
  fullSizeCards: boolean;
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
  dir = "auto",
  fullSizeCards,
}: Readonly<NPSQuestionProps>) {
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
    if (idx > 8) return "bg-emerald-100";
    if (idx > 6) return "bg-orange-100";
    return "bg-rose-100";
  };

  return (
    <ScrollableContainer fullSizeCards={fullSizeCards}>
      <form
        key={question.id}
        onSubmit={(e) => {
          e.preventDefault();
          const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
          setTtc(updatedTtcObj);
          onSubmit({ [question.id]: value ?? "" }, updatedTtcObj);
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
        <div className="my-4">
          <fieldset>
            <legend className="sr-only">Options</legend>
            <div className="flex">
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
                    onFocus={() => {
                      setHoveredNumber(number);
                    }}
                    onBlur={() => {
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
                        ? "border-border-highlight bg-accent-selected-bg z-10 border"
                        : "border-border",
                      "text-heading focus:border-brand relative h-10 flex-1 cursor-pointer overflow-hidden border-b border-l border-t text-center text-sm focus:border-2 focus:outline-none",
                      question.isColorCodingEnabled ? "h-[46px] leading-[3.5em]" : "h leading-10",
                      hoveredNumber === number ? "bg-accent-bg" : "",
                      dir === "rtl"
                        ? "first:rounded-r-custom last:rounded-l-custom first:border-r last:border-l"
                        : "first:rounded-l-custom last:rounded-r-custom first:border-l last:border-r"
                    )}>
                    {question.isColorCodingEnabled ? (
                      <div className={`absolute left-0 top-0 h-[6px] w-full ${getNPSOptionColor(idx)}`} />
                    ) : null}
                    <input
                      type="radio"
                      id={number.toString()}
                      name="nps"
                      value={number}
                      checked={value === number}
                      className="absolute left-0 h-full w-full cursor-pointer opacity-0"
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
            <div className="text-subheading mt-2 flex justify-between gap-8 px-1.5 text-xs leading-6">
              <p dir="auto" className="max-w-[50%]">
                {getLocalizedValue(question.lowerLabel, languageCode)}
              </p>
              <p dir="auto" className="max-w-[50%]">
                {getLocalizedValue(question.upperLabel, languageCode)}
              </p>
            </div>
          </fieldset>
        </div>
        <div className="flex w-full flex-row-reverse justify-between pt-4">
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
    </ScrollableContainer>
  );
}
