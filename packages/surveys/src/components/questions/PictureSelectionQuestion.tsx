import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import QuestionImage from "@/components/general/QuestionImage";
import Subheader from "@/components/general/Subheader";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "preact/hooks";

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
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />
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
                  "border-border focus:border-border-highlight focus:bg-accent-selected-bg group/image relative box-border inline-block h-28 w-full cursor-pointer overflow-hidden rounded-xl border focus:outline-none"
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
                  rel="noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="z-2 absolute bottom-2 left-1/2 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-md bg-gray-800 p-2 text-xs text-white opacity-0 transition duration-300 ease-in-out hover:bg-gray-700 group-hover/image:opacity-100">
                  <span>Open in new tab</span>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="2"
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    class="lucide lucide-square-arrow-up-right">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M8 8h8v8" />
                    <path d="m8 16 8-8" />
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
