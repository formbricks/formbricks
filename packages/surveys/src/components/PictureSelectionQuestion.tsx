import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyPictureSelectionQuestion } from "@formbricks/types/surveys";
import { useEffect, useRef } from "preact/hooks";
import { cn } from "../lib/utils";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";

interface PictureSelectionProps {
  question: TSurveyPictureSelectionQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, isSubmit: boolean, time: number) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
}

export default function PictureSelectionQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
}: PictureSelectionProps) {
  const startTime = useRef<number>(performance.now());

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Restart the timer when the tab becomes visible again
        startTime.current = performance.now();
      } else {
        onSubmit({ [question.id]: value }, false, performance.now() - startTime.current);
      }
    };

    // Attach the event listener
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      // Clean up the event listener when the component is unmounted
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);
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
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit({ [question.id]: value }, true, performance.now() - startTime.current);
      }}
      className="w-full">
      {question.imageUrl && (
        <div className="my-4 rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={question.imageUrl} alt="question-image" className={"my-4 rounded-md"} />
        </div>
      )}
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        <fieldset>
          <legend className="sr-only">Options</legend>
          <div className="relative grid max-h-[42vh] grid-cols-2 gap-x-5 gap-y-4 overflow-y-auto rounded-md bg-white pr-2.5">
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
                style={{
                  borderColor:
                    Array.isArray(value) && value.includes(choice.id) ? brandColor : "border-slate-400",
                  color: brandColor,
                }}
                onClick={() => handleChange(choice.id)}
                className={cn(
                  Array.isArray(value) && value.includes(choice.id)
                    ? `z-10 border-4 shadow-xl focus:border-4`
                    : "",
                  "relative box-border inline-block h-28 w-full overflow-hidden rounded-xl border border-slate-400 focus:border-slate-600 focus:bg-slate-50 focus:outline-none"
                )}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={choice.imageUrl}
                  id={choice.id}
                  alt={choice.imageUrl.split("/").pop()}
                  className="h-full w-full object-cover"
                />
                {question.allowMulti ? (
                  <input
                    id={`${choice.id}-checked`}
                    name={`${choice.id}-checkbox`}
                    type="checkbox"
                    tabindex={-1}
                    checked={Array.isArray(value) && value.includes(choice.id)}
                    style={{ borderColor: brandColor, color: brandColor }}
                    className="pointer-events-none absolute right-2 top-2 z-20 h-5 w-5 rounded border border-slate-400"
                    required={
                      question.required && Array.isArray(value) && value.length ? false : question.required
                    }
                  />
                ) : (
                  <input
                    id={`${choice.id}-radio`}
                    name={`${choice.id}-radio`}
                    type="radio"
                    tabindex={-1}
                    checked={Array.isArray(value) && value.includes(choice.id)}
                    style={{ borderColor: brandColor, color: brandColor }}
                    className="pointer-events-none absolute right-2 top-2 z-20 h-5 w-5 "
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
              onSubmit({ [question.id]: value }, false, performance.now() - startTime.current);
              onBack();
            }}
          />
        )}
        <div></div>
        <SubmitButton
          tabIndex={questionChoices.length + 2}
          buttonLabel={question.buttonLabel}
          isLastQuestion={isLastQuestion}
          brandColor={brandColor}
          onClick={() => {
            onSubmit({ [question.id]: value }, true, performance.now() - startTime.current);
          }}
        />
      </div>
    </form>
  );
}
