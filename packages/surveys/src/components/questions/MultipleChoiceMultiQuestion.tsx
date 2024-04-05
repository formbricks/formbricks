import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import Subheader from "@/components/general/Subheader";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn, shuffleQuestions } from "@/lib/utils";
import { useCallback, useEffect, useMemo, useRef, useState } from "preact/hooks";

import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyMultipleChoiceMultiQuestion } from "@formbricks/types/surveys";

interface MultipleChoiceMultiProps {
  question: TSurveyMultipleChoiceMultiQuestion;
  value: string[];
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

export const MultipleChoiceMultiQuestion = ({
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
  isInIframe,
}: MultipleChoiceMultiProps) => {
  const [startTime, setStartTime] = useState(performance.now());
  const isMediaAvailable = question.imageUrl || question.videoUrl;

  useTtc(question.id, ttc, setTtc, startTime, setStartTime);

  const getChoicesWithoutOtherLabels = useCallback(
    () =>
      question.choices
        .filter((choice) => choice.id !== "other")
        .map((item) => getLocalizedValue(item.label, languageCode)),
    [question, languageCode]
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
      (Array.isArray(value) &&
        value.filter((v) => !question.choices.find((c) => c.label[languageCode] === v))[0]) ||
        ""
    );
  }, [question.id, getChoicesWithoutOtherLabels, question.choices, value, languageCode]);

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
    return questionChoice.label[languageCode];
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
      <div className="mt-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div
            className="bg-survey-bg relative max-h-[33vh] space-y-2 overflow-y-auto py-0.5 pr-2"
            ref={choicesContainerRef}>
            {questionChoices.map((choice, idx) => (
              <label
                key={choice.id}
                tabIndex={idx + 1}
                className={cn(
                  value === choice.label ? "border-border bg-input-selected-bg z-10" : "border-border",
                  "text-heading bg-input-bg focus-within:border-brand hover:bg-input-bg-selected focus:bg-input-bg-selected rounded-custom relative flex cursor-pointer flex-col border p-4 focus:outline-none"
                )}
                onKeyDown={(e) => {
                  // Accessibility: if spacebar was pressed pass this down to the input
                  if (e.key === " ") {
                    e.preventDefault();
                    document.getElementById(choice.id)?.click();
                    document.getElementById(choice.id)?.focus();
                  }
                }}
                autoFocus={idx === 0 && !isInIframe}>
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
                        addItem(getLocalizedValue(choice.label, languageCode));
                      } else {
                        removeItem(getLocalizedValue(choice.label, languageCode));
                      }
                    }}
                    checked={
                      Array.isArray(value) && value.includes(getLocalizedValue(choice.label, languageCode))
                    }
                    required={
                      question.required && Array.isArray(value) && value.length ? false : question.required
                    }
                  />
                  <span id={`${choice.id}-label`} className="ml-3 font-medium">
                    {getLocalizedValue(choice.label, languageCode)}
                  </span>
                </span>
              </label>
            ))}
            {otherOption && (
              <label
                tabIndex={questionChoices.length + 1}
                className={cn(
                  value.includes(getLocalizedValue(otherOption.label, languageCode))
                    ? "border-border bg-input-selected-bg z-10"
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
                    type="checkbox"
                    tabIndex={-1}
                    id={otherOption.id}
                    name={question.id}
                    value={getLocalizedValue(otherOption.label, languageCode)}
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
                    {getLocalizedValue(otherOption.label, languageCode)}
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
                    className="placeholder:text-placeholder border-border bg-survey-bg text-heading focus:ring-focus rounded-custom mt-3 flex h-10 w-full border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            tabIndex={questionChoices.length + 3}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
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
