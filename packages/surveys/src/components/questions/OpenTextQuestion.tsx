import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import Subheader from "@/components/general/Subheader";
import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyOpenTextQuestion } from "@formbricks/types/surveys";
import { useCallback } from "react";
import { useState, useEffect } from "react";
import { TResponseTtc } from "@formbricks/types/responses";
import { getUpdatedTtcObj } from "../../lib/utils";

interface OpenTextQuestionProps {
  question: TSurveyOpenTextQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  autoFocus?: boolean;
  ttcObj: TResponseTtc;
  setTtcObj: (ttc: TResponseTtc) => void;
}

export default function OpenTextQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  autoFocus = true,
  ttcObj,
  setTtcObj,
}: OpenTextQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());

  useEffect(() => {
    setStartTime(performance.now());
  }, [question.id]);
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Restart the timer when the tab becomes visible again
        setStartTime(performance.now());
      } else {
        const updatedTtcObj = getUpdatedTtcObj(ttcObj, question.id, performance.now() - startTime);
        setTtcObj(updatedTtcObj);
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
    [question.id]
  );
  const isInputEmpty = (value: string) => {
    return question.required && !value?.trim();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        //  if ( validateInput(value as string, question.inputType, question.required)) {
        const updatedTtcObj = getUpdatedTtcObj(ttcObj, question.id, performance.now() - startTime);
        setTtcObj(updatedTtcObj);
        onSubmit({ [question.id]: value, inputType: question.inputType }, updatedTtcObj);
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
            className="border-border bg-survey-bg focus:border-border-highlight block w-full rounded-md border p-2 shadow-sm focus:outline-none focus:ring-0 sm:text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && isInputEmpty(value as string)) {
                e.preventDefault(); // Prevent form submission
              } else if (e.key === "Enter") {
                const updatedTtcObj = getUpdatedTtcObj(ttcObj, question.id, performance.now() - startTime);
                setTtcObj(updatedTtcObj);
                onSubmit({ [question.id]: value, inputType: question.inputType }, updatedTtcObj);
              }
            }}
            pattern={question.inputType === "phone" ? "[+][0-9 ]+" : ".*"}
            title={question.inputType === "phone" ? "Enter a valid phone number" : undefined}
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
            className="border-border bg-survey-bg text-subheading focus:border-border-highlight block w-full rounded-md border p-2 shadow-sm focus:ring-0 sm:text-sm"
            pattern={question.inputType === "phone" ? "[+][0-9 ]+" : ".*"}
            title={question.inputType === "phone" ? "Please enter a valid phone number" : undefined}
          />
        )}
      </div>

      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={question.backButtonLabel}
            onClick={() => {
              const updatedTtcObj = getUpdatedTtcObj(ttcObj, question.id, performance.now() - startTime);
              setTtcObj(updatedTtcObj);
              onBack();
            }}
          />
        )}
        <div></div>
        <SubmitButton buttonLabel={question.buttonLabel} isLastQuestion={isLastQuestion} onClick={() => {}} />
      </div>
    </form>
  );
}
