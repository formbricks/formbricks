import { BackButton } from "@/components/buttons/BackButton";
import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import { Subheader } from "@/components/general/Subheader";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn, getShuffledChoicesIds } from "@/lib/utils";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyMultipleChoiceQuestion } from "@formbricks/types/surveys/types";

interface MultipleChoiceSingleProps {
  question: TSurveyMultipleChoiceQuestion;
  value?: string;
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

export const MultipleChoiceSingleQuestion = ({
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
}: MultipleChoiceSingleProps) => {
  const [startTime, setStartTime] = useState(performance.now());
  const [otherSelected, setOtherSelected] = useState(false);
  const otherSpecify = useRef<HTMLInputElement | null>(null);
  const choicesContainerRef = useRef<HTMLDivElement | null>(null);
  const isMediaAvailable = question.imageUrl || question.videoUrl;

  const shuffledChoicesIds = useMemo(() => {
    if (question.shuffleOption) {
      return getShuffledChoicesIds(question.choices, question.shuffleOption);
    } else return question.choices.map((choice) => choice.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.shuffleOption, question.choices.length, question.choices[question.choices.length - 1].id]);

  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  const questionChoices = useMemo(() => {
    if (!question.choices) {
      return [];
    }
    if (question.shuffleOption === "none" || question.shuffleOption === undefined) return question.choices;
    return shuffledChoicesIds.map((choiceId) => {
      const choice = question.choices.find((choice) => {
        return choice.id === choiceId;
      });
      return choice;
    });
  }, [question.choices, question.shuffleOption, shuffledChoicesIds]);

  const otherOption = useMemo(
    () => question.choices.find((choice) => choice.id === "other"),
    [question.choices]
  );

  useEffect(() => {
    if (isFirstQuestion && !value) {
      const prefillAnswer = new URLSearchParams(window.location.search).get(question.id);
      if (prefillAnswer) {
        if (otherOption && prefillAnswer === getLocalizedValue(otherOption.label, languageCode)) {
          setOtherSelected(true);
          return;
        }
      }
    }

    const isOtherSelected =
      value !== undefined && !questionChoices.some((choice) => choice?.label[languageCode] === value);
    setOtherSelected(isOtherSelected);
  }, [isFirstQuestion, languageCode, otherOption, question.id, questionChoices, value]);

  useEffect(() => {
    // Scroll to the bottom of choices container and focus on 'otherSpecify' input when 'otherSelected' is true
    if (otherSelected && choicesContainerRef.current && otherSpecify.current) {
      choicesContainerRef.current.scrollTop = choicesContainerRef.current.scrollHeight;
      otherSpecify.current.focus();
    }
  }, [otherSelected]);

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value ?? "" }, updatedTtcObj);
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
            <fieldset>
              <legend className="fb-sr-only">Options</legend>

              <div
                className="fb-bg-survey-bg fb-relative fb-space-y-2"
                role="radiogroup"
                ref={choicesContainerRef}>
                {questionChoices.map((choice, idx) => {
                  if (!choice || choice.id === "other") return;
                  return (
                    <label
                      dir="auto"
                      tabIndex={idx + 1}
                      key={choice.id}
                      className={cn(
                        value === getLocalizedValue(choice.label, languageCode)
                          ? "fb-border-brand fb-bg-input-bg-selected fb-z-10"
                          : "fb-border-border",
                        "fb-text-heading fb-bg-input-bg focus-within:fb-border-brand focus-within:fb-bg-input-bg-selected hover:fb-bg-input-bg-selected fb-rounded-custom fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-border fb-p-4 focus:fb-outline-none"
                      )}
                      onKeyDown={(e) => {
                        // Accessibility: if spacebar was pressed pass this down to the input
                        if (e.key === " ") {
                          e.preventDefault();
                          document.getElementById(choice.id)?.click();
                          document.getElementById(choice.id)?.focus();
                        }
                      }}
                      autoFocus={idx === 0 && autoFocusEnabled}>
                      <span className="fb-flex fb-items-center fb-text-sm">
                        <input
                          tabIndex={-1}
                          type="radio"
                          id={choice.id}
                          name={question.id}
                          value={getLocalizedValue(choice.label, languageCode)}
                          dir="auto"
                          className="fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-border focus:fb-ring-0 focus:fb-ring-offset-0"
                          aria-labelledby={`${choice.id}-label`}
                          onChange={() => {
                            setOtherSelected(false);
                            onChange({ [question.id]: getLocalizedValue(choice.label, languageCode) });
                          }}
                          checked={value === getLocalizedValue(choice.label, languageCode)}
                          required={question.required && idx === 0}
                        />
                        <span id={`${choice.id}-label`} className="fb-ml-3 fb-mr-3 fb-grow fb-font-medium">
                          {getLocalizedValue(choice.label, languageCode)}
                        </span>
                      </span>
                    </label>
                  );
                })}
                {otherOption && (
                  <label
                    dir="auto"
                    tabIndex={questionChoices.length + 1}
                    className={cn(
                      value === getLocalizedValue(otherOption.label, languageCode)
                        ? "fb-border-brand fb-bg-input-bg-selected fb-z-10"
                        : "fb-border-border",
                      "fb-text-heading focus-within:fb-border-brand fb-bg-input-bg focus-within:fb-bg-input-bg-selected hover:fb-bg-input-bg-selected fb-rounded-custom fb-relative fb-flex fb-cursor-pointer fb-flex-col fb-border fb-p-4 focus:fb-outline-none"
                    )}
                    onKeyDown={(e) => {
                      // Accessibility: if spacebar was pressed pass this down to the input
                      if (e.key === " ") {
                        if (otherSelected) return;
                        document.getElementById(otherOption.id)?.click();
                        document.getElementById(otherOption.id)?.focus();
                      }
                    }}>
                    <span className="fb-flex fb-items-center fb-text-sm">
                      <input
                        dir="auto"
                        type="radio"
                        id={otherOption.id}
                        tabIndex={-1}
                        name={question.id}
                        value={getLocalizedValue(otherOption.label, languageCode)}
                        className="fb-border-brand fb-text-brand fb-h-4 fb-w-4 fb-border focus:fb-ring-0 focus:fb-ring-offset-0"
                        aria-labelledby={`${otherOption.id}-label`}
                        onChange={() => {
                          setOtherSelected(!otherSelected);
                          onChange({ [question.id]: "" });
                        }}
                        checked={otherSelected}
                      />
                      <span
                        id={`${otherOption.id}-label`}
                        className="fb-ml-3 fb-mr-3 fb-grow fb-font-medium"
                        dir="auto">
                        {getLocalizedValue(otherOption.label, languageCode)}
                      </span>
                    </span>
                    {otherSelected && (
                      <input
                        ref={otherSpecify}
                        tabIndex={questionChoices.length + 1}
                        id={`${otherOption.id}-label`}
                        dir="auto"
                        name={question.id}
                        value={value}
                        onChange={(e) => {
                          onChange({ [question.id]: e.currentTarget.value });
                        }}
                        className="placeholder:fb-text-placeholder fb-border-border fb-bg-survey-bg fb-text-heading focus:fb-ring-focus fb-rounded-custom fb-mt-3 fb-flex fb-h-10 fb-w-full fb-border fb-px-3 fb-py-2 fb-text-sm focus:fb-outline-none focus:fb-ring-2 focus:fb-ring-offset-2 disabled:fb-cursor-not-allowed disabled:fb-opacity-50"
                        placeholder={
                          getLocalizedValue(question.otherOptionPlaceholder, languageCode) ?? "Please specify"
                        }
                        required={question.required}
                        aria-labelledby={`${otherOption.id}-label`}
                      />
                    )}
                  </label>
                )}
              </div>
            </fieldset>
          </div>
        </div>
      </ScrollableContainer>
      <div className="fb-flex fb-w-full fb-justify-between fb-px-6 fb-py-4">
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            tabIndex={questionChoices.length + 3}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedTtcObj);
              onBack();
            }}
          />
        )}
        <div></div>
        <SubmitButton
          tabIndex={questionChoices.length + 2}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
        />
      </div>
    </form>
  );
};
