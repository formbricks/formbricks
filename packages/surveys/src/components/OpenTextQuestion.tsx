import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyOpenTextQuestion } from "@formbricks/types/surveys";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";
import { useCallback, useRef, useEffect } from "react";

interface OpenTextQuestionProps {
  question: TSurveyOpenTextQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, isSubmit: boolean, time: number) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
  autoFocus?: boolean;
}

export default function OpenTextQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
  autoFocus = true,
}: OpenTextQuestionProps) {
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

  const handleInputChange = (inputValue: string) => {
    // const isValidInput = validateInput(inputValue, question.inputType, question.required);
    // setIsValid(isValidInput);
    onChange({ [question.id]: inputValue });
  };
  const openTextRef = useCallback(
    (currentElement: HTMLInputElement | HTMLTextAreaElement | null) => {
      if (currentElement && autoFocus) {
        currentElement.focus();
      }
    },
    [autoFocus]
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        //  if ( validateInput(value as string, question.inputType, question.required)) {
        onSubmit(
          { [question.id]: value, inputType: question.inputType },
          true,
          performance.now() - startTime.current
        );
        // }
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
        {question.longAnswer === false ? (
          <input
            ref={openTextRef}
            tabIndex={1}
            name={question.id}
            id={question.id}
            placeholder={question.placeholder}
            required={question.required}
            value={value ? (value as string) : ""}
            type={question.inputType}
            onInput={(e) => handleInputChange(e.currentTarget.value)}
            autoFocus={autoFocus}
            onKeyDown={(e) => {
              if (e.key == "Enter")
                onSubmit({ [question.id]: value }, true, performance.now() - startTime.current);
            }}
            pattern={question.inputType === "phone" ? "[+][0-9 ]+" : ".*"}
            title={question.inputType === "phone" ? "Enter a valid phone number" : undefined}
            className={`block w-full rounded-md border
       border-slate-100
       bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-0 sm:text-sm`}
          />
        ) : (
          <textarea
            ref={openTextRef}
            rows={3}
            name={question.id}
            tabIndex={1}
            id={question.id}
            placeholder={question.placeholder}
            required={question.required}
            value={value as string}
            type={question.inputType}
            onInput={(e) => handleInputChange(e.currentTarget.value)}
            autoFocus={autoFocus}
            pattern={question.inputType === "phone" ? "[+][0-9 ]+" : ".*"}
            title={question.inputType === "phone" ? "Please enter a valid phone number" : undefined}
            className={`block w-full rounded-md border
      border-slate-100
      bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-0 sm:text-sm`}></textarea>
        )}
      </div>

      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              onSubmit({ [question.id]: value }, false, performance.now() - startTime.current);
              onBack();
            }}
          />
        )}
        <div></div>
        <SubmitButton
          buttonLabel={question.buttonLabel}
          isLastQuestion={isLastQuestion}
          brandColor={brandColor}
          onClick={() => {
            onSubmit(
              { [question.id]: value, inputType: question.inputType },
              true,
              performance.now() - startTime.current
            );
          }}
        />
      </div>
    </form>
  );
}
