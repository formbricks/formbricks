import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import QuestionImage from "@/components/general/QuestionImage";
import Subheader from "@/components/general/Subheader";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { getLocalizedValue } from "@/lib/utils";
import { useState } from "preact/hooks";
import { useCallback } from "react";

import { TResponseData } from "@formbricks/types/responses";
import { TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyOpenTextQuestion } from "@formbricks/types/surveys";

interface OpenTextQuestionProps {
  question: TSurveyOpenTextQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  autoFocus?: boolean;
  language: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
}

export default function OpenTextQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  language,
  autoFocus = true,
  ttc,
  setTtc,
}: OpenTextQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());

  useTtc(question.id, ttc, setTtc, startTime, setStartTime);

  const handleInputChange = (inputValue: string) => {
    // const isValidInput = validateInput(inputValue, question.inputType, question.required);
    // setIsValid(isValidInput);
    onChange({ [question.id]: inputValue });
  };
  const openTextRef = useCallback(
    (currentElement: HTMLInputElement | HTMLTextAreaElement | null) => {
      if (question.id && currentElement && autoFocus) {
        currentElement.focus();
      }
    },
    [question.id, autoFocus]
  );
  const isInputEmpty = (value: string) => {
    return question.required && !value?.trim();
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        //  if ( validateInput(value as string, question.inputType, question.required)) {
        const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedttc);
        onSubmit({ [question.id]: value, inputType: question.inputType }, updatedttc);
        // }
      }}
      className="w-full">
      {question.imageUrl && <QuestionImage imgUrl={question.imageUrl} />}
      <Headline
        headline={getLocalizedValue(question.headline, language)}
        questionId={question.id}
        required={question.required}
      />
      <Subheader
        subheader={question.subheader ? getLocalizedValue(question.subheader, language) : ""}
        questionId={question.id}
      />
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
                const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                setTtc(updatedttc);
                onSubmit({ [question.id]: value, inputType: question.inputType }, updatedttc);
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
              const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedttc);
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
