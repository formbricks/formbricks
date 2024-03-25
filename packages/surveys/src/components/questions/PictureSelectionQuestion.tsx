import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import QuestionImage from "@/components/general/QuestionImage";
import Subheader from "@/components/general/Subheader";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "preact/hooks";

import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyPictureSelectionQuestion } from "@formbricks/types/surveys";

interface PictureSelectionProps {
  question: TSurveyPictureSelectionQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
}

export default function PictureSelectionQuestion({
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
}: PictureSelectionProps) {
  const [startTime, setStartTime] = useState(performance.now());

  useTtc(question.id, ttc, setTtc, startTime, setStartTime);

  const addItem = (item: string) => {
    let values: string[] = [];

    if (question.allowMulti) {
      if (Array.isArray(value)) {
        values = [...value, item];
      } else {
        values = [item];
      }
    } else {
      values = [item];
    }

    return onChange({ [question.id]: values });
  };

  const removeItem = (item: string) => {
    let values: string[] = [];

    if (question.allowMulti) {
      if (Array.isArray(value)) {
        values = value.filter((i) => i !== item);
      } else {
        values = [];
      }
    } else {
      values = [];
    }

    return onChange({ [question.id]: values });
  };

  const handleChange = (id: string) => {
    if (Array.isArray(value) && value.includes(id)) {
      removeItem(id);
    } else {
      addItem(id);
    }
  };

  useEffect(() => {
    if (!question.allowMulti && Array.isArray(value) && value.length > 1) {
      onChange({ [question.id]: [] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.allowMulti]);

  const questionChoices = question.choices;

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value }, updatedTtcObj);
      }}
      className="w-full">
      {question.imageUrl && <QuestionImage imgUrl={question.imageUrl} />}
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
          <div className="rounded-m bg-survey-bg relative grid max-h-[33vh] grid-cols-2 gap-x-5 gap-y-4 overflow-y-auto">
            {questionChoices.map((choice, idx) => (
              <label
                key={choice.id}
                tabIndex={idx + 1}
                htmlFor={choice.id}
                onKeyDown={(e) => {
                  if (e.key == "Enter") {
                    handleChange(choice.id);
                  }
                }}
                onClick={() => handleChange(choice.id)}
                className={cn(
                  Array.isArray(value) && value.includes(choice.id)
                    ? `border-brand text-brand z-10 border-4 shadow-xl focus:border-4`
                    : "",
                  "border-border focus:bg-accent-selected-bg relative box-border inline-block h-28 w-full overflow-hidden rounded-xl border focus:outline-none"
                )}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={choice.imageUrl}
                  id={choice.id}
                  alt={choice.imageUrl.split("/").pop()}
                  className="h-full w-full object-cover"
                />
                <a
                  href={choice.imageUrl}
                  target="_blank"
                  title="Open in new tab"
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="absolute bottom-2 right-2 flex items-center gap-2 whitespace-nowrap rounded-md bg-gray-800 bg-opacity-40 p-1.5 text-white opacity-0 backdrop-blur-lg transition duration-300 ease-in-out hover:bg-opacity-65 group-hover/image:opacity-100">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-expand">
                    <path d="m21 21-6-6m6 6v-4.8m0 4.8h-4.8" />
                    <path d="M3 16.2V21m0 0h4.8M3 21l6-6" />
                    <path d="M21 7.8V3m0 0h-4.8M21 3l-6 6" />
                    <path d="M3 7.8V3m0 0h4.8M3 3l6 6" />
                  </svg>
                </a>
                {question.allowMulti ? (
                  <input
                    id={`${choice.id}-checked`}
                    name={`${choice.id}-checkbox`}
                    type="checkbox"
                    tabIndex={-1}
                    checked={Array.isArray(value) && value.includes(choice.id)}
                    className={cn(
                      "border-border pointer-events-none absolute right-2 top-2 z-20 h-5 w-5 rounded border",
                      Array.isArray(value) && value.includes(choice.id) ? "border-brand text-brand" : ""
                    )}
                    required={
                      question.required && Array.isArray(value) && value.length ? false : question.required
                    }
                  />
                ) : (
                  <input
                    id={`${choice.id}-radio`}
                    name={`${choice.id}-radio`}
                    type="radio"
                    tabIndex={-1}
                    checked={Array.isArray(value) && value.includes(choice.id)}
                    className={cn(
                      "border-border pointer-events-none absolute right-2 top-2 z-20 h-5 w-5 rounded-full border",
                      Array.isArray(value) && value.includes(choice.id) ? "border-brand text-brand" : ""
                    )}
                    required={
                      question.required && Array.isArray(value) && value.length ? false : question.required
                    }
                  />
                )}
              </label>
            ))}
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
          onClick={() => {}}
        />
      </div>
    </form>
  );
}
