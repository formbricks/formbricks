import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyOpenTextQuestion } from "@formbricks/types/v1/surveys";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";
// import { useState } from "preact/hooks";

// function validateInput(value: string, questionType: string, required: boolean): boolean {
//   if (!required && (value == undefined || value == "" || value == null || value.length <= 0)) {
//     return true;
//   }
//   switch (questionType) {
//     case "email":
//       const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//       return emailPattern.test(value);
//     case "url":
//       const urlPattern = /^(ftp|http|https):\/\/[^ "]+$/;
//       return urlPattern.test(value);
//     case "number":
//       const numberPattern = /^[0-9]*$/;
//       return numberPattern.test(value);
//     case "phone":
//       const phonePattern = /^\+[0-9]+$/;
//       return phonePattern.test(value);
//     default:
//       return true;
//   }
// }

interface OpenTextQuestionProps {
  question: TSurveyOpenTextQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
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
  const handleInputChange = (inputValue: string) => {
    // const isValidInput = validateInput(inputValue, question.inputType, question.required);
    // setIsValid(isValidInput);
    onChange({ [question.id]: inputValue });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        //  if ( validateInput(value as string, question.inputType, question.required)) {
        onSubmit({ [question.id]: value, inputType: question.inputType });
        // }
      }}
      className="w-full">
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        {question.longAnswer === false ? (
          <input
            name={question.id}
            id={question.id}
            placeholder={question.placeholder}
            required={question.required}
            value={value as string}
            type={question.inputType}
            onInput={(e) => handleInputChange(e.currentTarget.value)}
            autoFocus={autoFocus}
            pattern={question.inputType === "phone" ? "[+][0-9]+" : undefined}
            title={question.inputType === "phone" ? "Enter a valid phone number" : undefined}
            className={`block w-full rounded-md border
       border-slate-100
       bg-slate-50 p-2 shadow-sm focus:border-slate-500 focus:outline-none focus:ring-0 sm:text-sm`}
          />
        ) : (
          <textarea
            rows={3}
            name={question.id}
            id={question.id}
            placeholder={question.placeholder}
            required={question.required}
            value={value as string}
            type={question.inputType}
            onInput={(e) => handleInputChange(e.currentTarget.value)}
            autoFocus={autoFocus}
            pattern={question.inputType === "phone" ? "[+][0-9]+" : undefined}
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
              onBack();
            }}
          />
        )}
        <div></div>
        <SubmitButton
          question={question}
          isLastQuestion={isLastQuestion}
          brandColor={brandColor}
          onClick={() => {}}
        />
      </div>
    </form>
  );
}
