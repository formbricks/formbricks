import { useEffect, useMemo, useRef, useState } from "react";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyMultipleChoiceQuestion, TSurveyQuestionId } from "@formbricks/types/surveys/types";
import { getLocalizedValue } from "../../lib/i18n";
import { getUpdatedTtc, useTtc } from "../../lib/ttc";
import { cn, getShuffledChoicesIds } from "../../lib/utils";
import { BackButton } from "../buttons/back-button";
import { SubmitButton } from "../buttons/submit-button";
import { Headline } from "../general/headline";
import { QuestionMedia } from "../general/question-media";
import { Subheader } from "../general/subheader";
import { ScrollableContainer } from "../wrappers/scrollable-container";

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
  currentQuestionId: TSurveyQuestionId;
  isBackButtonHidden: boolean;
}

export function MultipleChoiceSingleQuestion({
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
  isBackButtonHidden,
}: MultipleChoiceSingleProps) {
  const [startTime, setStartTime] = useState(performance.now());
  const [otherSelected, setOtherSelected] = useState(false);
  const otherSpecify = useRef<HTMLInputElement | null>(null);
  const choicesContainerRef = useRef<HTMLDivElement | null>(null);
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  const isCurrent = question.id === currentQuestionId;
  const shuffledChoicesIds = useMemo(() => {
    if (question.shuffleOption) {
      return getShuffledChoicesIds(question.choices, question.shuffleOption);
    }
    return question.choices.map((choice) => choice.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only want to run this effect when question.choices changes
  }, [question.shuffleOption, question.choices.length, question.choices[question.choices.length - 1].id]);

  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  const questionChoices = useMemo(() => {
    if (!question.choices.length) {
      return [];
    }
    if (question.shuffleOption === "none" || question.shuffleOption === undefined) return question.choices;
    return shuffledChoicesIds.map((choiceId) => {
      const choice = question.choices.find((selectedChoice) => {
        return selectedChoice.id === choiceId;
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
      className="w-full">
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
          <div className="mt-4">
            <fieldset>
              <legend className="sr-only">Options</legend>

              <div className="bg-survey-bg relative space-y-2" role="radiogroup" ref={choicesContainerRef}>
                {questionChoices.map((choice, idx) => {
                  if (!choice || choice.id === "other") return;
                  return (
                    <label
                      dir="auto"
                      key={choice.id}
                      tabIndex={isCurrent ? 0 : -1}
                      className={cn(
                        value === getLocalizedValue(choice.label, languageCode)
                          ? "border-brand bg-input-bg-selected z-10"
                          : "border-border",
                        "text-heading bg-input-bg focus-within:border-brand focus-within:bg-input-bg-selected hover:bg-input-bg-selected rounded-custom relative flex cursor-pointer flex-col border p-4 focus:outline-none"
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
                      <span className="flex items-center text-sm">
                        <input
                          tabIndex={-1}
                          type="radio"
                          id={choice.id}
                          name={question.id}
                          value={getLocalizedValue(choice.label, languageCode)}
                          dir="auto"
                          className="border-brand text-brand h-4 w-4 border focus:ring-0 focus:ring-offset-0"
                          aria-labelledby={`${choice.id}-label`}
                          onChange={() => {
                            setOtherSelected(false);
                            onChange({ [question.id]: getLocalizedValue(choice.label, languageCode) });
                          }}
                          checked={value === getLocalizedValue(choice.label, languageCode)}
                          required={question.required ? idx === 0 : undefined}
                        />
                        <span id={`${choice.id}-label`} className="ml-3 mr-3 grow font-medium">
                          {getLocalizedValue(choice.label, languageCode)}
                        </span>
                      </span>
                    </label>
                  );
                })}
                {otherOption ? (
                  <label
                    dir="auto"
                    tabIndex={isCurrent ? 0 : -1}
                    className={cn(
                      value === getLocalizedValue(otherOption.label, languageCode)
                        ? "border-brand bg-input-bg-selected z-10"
                        : "border-border",
                      "text-heading focus-within:border-brand bg-input-bg focus-within:bg-input-bg-selected hover:bg-input-bg-selected rounded-custom relative flex cursor-pointer flex-col border p-4 focus:outline-none"
                    )}
                    onKeyDown={(e) => {
                      // Accessibility: if spacebar was pressed pass this down to the input
                      if (e.key === " ") {
                        if (otherSelected) return;
                        document.getElementById(otherOption.id)?.click();
                        document.getElementById(otherOption.id)?.focus();
                      }
                    }}>
                    <span className="flex items-center text-sm">
                      <input
                        tabIndex={-1}
                        dir="auto"
                        type="radio"
                        id={otherOption.id}
                        name={question.id}
                        value={getLocalizedValue(otherOption.label, languageCode)}
                        className="border-brand text-brand h-4 w-4 border focus:ring-0 focus:ring-offset-0"
                        aria-labelledby={`${otherOption.id}-label`}
                        onChange={() => {
                          setOtherSelected(!otherSelected);
                          onChange({ [question.id]: "" });
                        }}
                        checked={otherSelected}
                      />
                      <span id={`${otherOption.id}-label`} className="ml-3 mr-3 grow font-medium" dir="auto">
                        {getLocalizedValue(otherOption.label, languageCode)}
                      </span>
                    </span>
                    {otherSelected ? (
                      <input
                        ref={otherSpecify}
                        id={`${otherOption.id}-label`}
                        dir="auto"
                        name={question.id}
                        value={value}
                        onChange={(e) => {
                          onChange({ [question.id]: e.currentTarget.value });
                        }}
                        className="placeholder:text-placeholder border-border bg-survey-bg text-heading focus:ring-focus rounded-custom mt-3 flex h-10 w-full border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        placeholder={
                          getLocalizedValue(question.otherOptionPlaceholder, languageCode).length > 0
                            ? getLocalizedValue(question.otherOptionPlaceholder, languageCode)
                            : "Please specify"
                        }
                        required={question.required}
                        aria-labelledby={`${otherOption.id}-label`}
                      />
                    ) : null}
                  </label>
                ) : null}
              </div>
            </fieldset>
          </div>
        </div>
      </ScrollableContainer>
      <div className="flex w-full flex-row-reverse justify-between px-6 py-4">
        <SubmitButton
          tabIndex={isCurrent ? 0 : -1}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
        />
        {!isFirstQuestion && !isBackButtonHidden && (
          <BackButton
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            tabIndex={isCurrent ? 0 : -1}
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
