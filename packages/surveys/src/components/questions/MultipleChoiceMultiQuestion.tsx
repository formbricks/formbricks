import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import QuestionImage from "@/components/general/QuestionImage";
import Subheader from "@/components/general/Subheader";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn, shuffleQuestions } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyMultipleChoiceMultiQuestion } from "@formbricks/types/surveys";

interface MultipleChoiceMultiProps {
  question: TSurveyMultipleChoiceMultiQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
}

export default function MultipleChoiceMultiQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  ttc,
  setTtc,
}: MultipleChoiceMultiProps) {
  const [startTime, setStartTime] = useState(performance.now());

  useTtc(question.id, ttc, setTtc, startTime, setStartTime);

  const getChoicesWithoutOtherLabels = useCallback(
    () => question.choices.filter((choice) => choice.id !== "other").map((item) => item.label),
    [question]
  );
  const [otherSelected, setOtherSelected] = useState<boolean>(false);

  const [otherValue, setOtherValue] = useState("");
  useEffect(() => {
    setOtherSelected(
      !!value &&
        ((Array.isArray(value) ? value : [value]) as string[]).some((item) => {
          return getChoicesWithoutOtherLabels().includes(item) === false;
        })
    );
    setOtherValue(
      (Array.isArray(value) && value.filter((v) => !question.choices.find((c) => c.label === v))[0]) || ""
    );
  }, [question.id, getChoicesWithoutOtherLabels, question.choices, value]);

  const questionChoices = useMemo(() => {
    if (!question.choices) {
      return [];
    }
    const choicesWithoutOther = question.choices.filter((choice) => choice.id !== "other");
    if (question.shuffleOption) {
      return shuffleQuestions(choicesWithoutOther, question.shuffleOption);
    }
    return choicesWithoutOther;
  }, [question.choices, question.shuffleOption]);

  const questionChoiceLabels = questionChoices.map((questionChoice) => {
    return questionChoice.label;
  });

  const otherOption = useMemo(
    () => question.choices.find((choice) => choice.id === "other"),
    [question.choices]
  );

  const otherSpecify = useRef<HTMLInputElement | null>(null);
  const choicesContainerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Scroll to the bottom of choices container and focus on 'otherSpecify' input when 'otherSelected' is true
    if (otherSelected && choicesContainerRef.current && otherSpecify.current) {
      choicesContainerRef.current.scrollTop = choicesContainerRef.current.scrollHeight;
      otherSpecify.current.focus();
    }
  }, [otherSelected]);

  const addItem = (item: string) => {
    const isOtherValue = !questionChoiceLabels.includes(item);
    if (Array.isArray(value)) {
      if (isOtherValue) {
        const newValue = value.filter((v) => {
          return questionChoiceLabels.includes(v);
        });
        return onChange({ [question.id]: [...newValue, item] });
      } else {
        return onChange({ [question.id]: [...value, item] });
      }
    }
    return onChange({ [question.id]: [item] }); // if not array, make it an array
  };

  const removeItem = (item: string) => {
    if (Array.isArray(value)) {
      return onChange({ [question.id]: value.filter((i) => i !== item) });
    }
    return onChange({ [question.id]: [] }); // if not array, make it an array
  };

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        const newValue = (value as string[])?.filter((item) => {
          return getChoicesWithoutOtherLabels().includes(item) || item === otherValue;
        }); // filter out all those values which are either in getChoicesWithoutOtherLabels() (i.e. selected by checkbox) or the latest entered otherValue
        onChange({ [question.id]: newValue });
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value }, updatedTtcObj);
      }}
      className="w-full">
      {question.imageUrl && <QuestionImage imgUrl={question.imageUrl} />}
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div
            className="bg-survey-bg relative max-h-[33vh] space-y-2 overflow-y-auto rounded-md py-0.5 pr-2"
            ref={choicesContainerRef}>
            {questionChoices.map((choice, idx) => (
              <label
                key={choice.id}
                tabIndex={idx + 1}
                onKeyDown={(e) => {
                  if (e.key == "Enter") {
                    if (Array.isArray(value) && value.includes(choice.label)) {
                      removeItem(choice.label);
                    } else {
                      addItem(choice.label);
                    }
                  }
                }}
                className={cn(
                  value === choice.label
                    ? "border-border-highlight bg-accent-selected-bg z-10"
                    : "border-border",
                  "text-heading focus-within:border-border-highlight hover:bg-accent-bg focus:bg-accent-bg relative flex cursor-pointer flex-col rounded-md border p-4 focus:outline-none"
                )}>
                <span className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    id={choice.id}
                    name={question.id}
                    tabIndex={-1}
                    value={choice.label}
                    className="border-brand text-brand h-4 w-4 border focus:ring-0 focus:ring-offset-0"
                    aria-labelledby={`${choice.id}-label`}
                    onChange={(e) => {
                      if ((e.target as HTMLInputElement)?.checked) {
                        addItem(choice.label);
                      } else {
                        removeItem(choice.label);
                      }
                    }}
                    checked={Array.isArray(value) && value.includes(choice.label)}
                    required={
                      question.required && Array.isArray(value) && value.length ? false : question.required
                    }
                  />
                  <span id={`${choice.id}-label`} className="ml-3 font-medium">
                    {choice.label}
                  </span>
                </span>
              </label>
            ))}
            {otherOption && (
              <label
                tabIndex={questionChoices.length + 1}
                className={cn(
                  value === otherOption.label
                    ? "border-border-highlight bg-accent-selected-bg z-10"
                    : "border-border",
                  "text-heading focus-within:border-border-highlight focus-within:bg-accent-bg hover:bg-accent-bg relative flex cursor-pointer flex-col rounded-md border p-4 focus:outline-none"
                )}
                onKeyDown={(e) => {
                  if (e.key == "Enter") {
                    setOtherSelected(!otherSelected);
                  }
                }}>
                <span className="flex items-center text-sm">
                  <input
                    type="checkbox"
                    tabIndex={-1}
                    id={otherOption.id}
                    name={question.id}
                    value={otherOption.label}
                    className="border-brand text-brand h-4 w-4 border focus:ring-0 focus:ring-offset-0"
                    aria-labelledby={`${otherOption.id}-label`}
                    onChange={(e) => {
                      setOtherSelected(!otherSelected);
                      if ((e.target as HTMLInputElement)?.checked) {
                        if (!otherValue) return;
                        addItem(otherValue);
                      } else {
                        removeItem(otherValue);
                      }
                    }}
                    checked={otherSelected}
                  />
                  <span id={`${otherOption.id}-label`} className="ml-3 font-medium">
                    {otherOption.label}
                  </span>
                </span>
                {otherSelected && (
                  <input
                    ref={otherSpecify}
                    id={`${otherOption.id}-label`}
                    name={question.id}
                    tabIndex={questionChoices.length + 1}
                    value={otherValue}
                    onChange={(e) => {
                      setOtherValue(e.currentTarget.value);
                      addItem(e.currentTarget.value);
                    }}
                    onKeyDown={(e) => {
                      if (e.key == "Enter") {
                        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                        setTtc(updatedTtcObj);
                        setTimeout(() => {
                          onSubmit({ [question.id]: value }, updatedTtcObj);
                        }, 100);
                      }
                    }}
                    placeholder={question.otherOptionPlaceholder ?? "Please specify"}
                    className="placeholder:text-placeholder border-border bg-survey-bg text-heading focus:ring-focus mt-3 flex h-10 w-full rounded-md border px-3 py-2 text-sm  focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    required={question.required}
                    aria-labelledby={`${otherOption.id}-label`}
                  />
                )}
              </label>
            )}
          </div>
        </fieldset>
      </div>
      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            tabIndex={questionChoices.length + 3}
            backButtonLabel={question.backButtonLabel}
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
          buttonLabel={question.buttonLabel}
          isLastQuestion={isLastQuestion}
          onClick={() => {}}
        />
      </div>
    </form>
  );
}
