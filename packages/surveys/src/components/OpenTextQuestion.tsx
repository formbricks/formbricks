import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyOpenTextQuestion } from "@formbricks/types/surveys";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";
import { useCallback } from "react";
import { useMemo } from "preact/hooks";
import { TSurveyWithTriggers } from "@formbricks/types/js";

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
  survey: TSurveyWithTriggers;
  responseData: TResponseData;
}

export default function OpenTextQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  responseData,
  isFirstQuestion,
  isLastQuestion,
  survey,
  brandColor,
  autoFocus = true,
}: OpenTextQuestionProps) {
  const handleInputChange = (inputValue: string) => {
    // const isValidInput = validateInput(inputValue, question.inputType, question.required);
    // setIsValid(isValidInput);
    onChange({ [question.id]: inputValue });
  };
  const openTextRef = useCallback((currentElement: HTMLInputElement | HTMLTextAreaElement | null) => {
    if (currentElement && autoFocus) {
      currentElement.focus();
    }
  }, []);

  const questionHeadlineWithRecall = useMemo(() => {
    const arr = question.headline.split(" ");
    for (let i = 0; i < arr.length; i++) {
      const x = arr[i];
      if (x.includes("PJ9A9hiyITOyMgWlF4H5j6otrBexUTG8:")) {
        let prevQid = x.split(":")[1];

        if (prevQid.includes("/fallback")) {
          prevQid = prevQid.split("/fallback")[0];
        }

        const fbq = x.split("/")[1];

        const fallback = fbq ? decodeURI(fbq.split(":")[1]) : undefined;

        const prevQ = survey.questions.find((q) => q.id === prevQid);

        if (prevQ) {
          const prevR = responseData[prevQ.id];

          if (prevR) {
            arr[i] = prevR as string;
            return arr.join(" ");
          } else if (fallback) {
            arr[i] = fallback;
            return arr.join(" ");
          } else {
            arr[i] = "";
            return arr.join(" ");
          }
        }
      }
    }
    return question.headline;
    // if (question.headline.includes("PJ9A9hiyITOyMgWlF4H5j6otrBexUTG8"))
  }, [question.headline, responseData, survey.questions]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        //  if ( validateInput(value as string, question.inputType, question.required)) {
        onSubmit({ [question.id]: value, inputType: question.inputType });
        // }
      }}
      className="w-full">
      {question.imageUrl && (
        <div className="my-4 rounded-md">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={question.imageUrl} alt="question-image" className={"my-4 rounded-md"} />
        </div>
      )}
      <Headline headline={questionHeadlineWithRecall} questionId={question.id} required={question.required} />
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
            value={value as string}
            type={question.inputType}
            onInput={(e) => handleInputChange(e.currentTarget.value)}
            autoFocus={autoFocus}
            onKeyDown={(e) => {
              if (e.key == "Enter") onSubmit({ [question.id]: value });
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
              onBack();
            }}
          />
        )}
        <div></div>
        <SubmitButton
          buttonLabel={question.buttonLabel}
          isLastQuestion={isLastQuestion}
          brandColor={brandColor}
          onClick={() => {}}
        />
      </div>
    </form>
  );
}
