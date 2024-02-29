import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import QuestionImage from "@/components/general/QuestionImage";
import Subheader from "@/components/general/Subheader";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { useState } from "preact/hooks";

import { TResponseData } from "@formbricks/types/responses";
import { TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyAddressQuestion } from "@formbricks/types/surveys";

interface AddressQuestionProps {
  question: TSurveyAddressQuestion;
  value: string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  autoFocus?: boolean;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
}

export default function AddressQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  autoFocus = true,
  ttc,
  setTtc,
}: AddressQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());

  useTtc(question.id, ttc, setTtc, startTime, setStartTime);
  const handleInputChange = (inputValue: string, index: number) => {
    const updatedValue = value ? [...value] : ["", "", "", "", "", ""];

    updatedValue[index] = inputValue;
    onChange({ [question.id]: updatedValue });
  };

  return (
    <form
      key={question.id}
      onSubmit={(e) => {
        e.preventDefault();
        const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedttc);
        onSubmit({ [question.id]: value }, updatedttc);
      }}
      className="w-full">
      {question.imageUrl && <QuestionImage imgUrl={question.imageUrl} />}
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4">
        <input
          tabIndex={1}
          name={question.id}
          id={question.id}
          step={"any"}
          placeholder={"Address e.g. Bay Street 69"}
          required={question.required || question.addressRequired}
          value={value && value[0] ? (value[0] as string) : ""}
          onInput={(e) => handleInputChange(e.currentTarget.value, 0)}
          autoFocus={autoFocus}
          className="border-border bg-survey-bg focus:border-border-highlight block w-full rounded-md border p-2 shadow-sm focus:outline-none focus:ring-0 sm:text-sm"
        />
      </div>
      <div className="mt-4">
        <input
          tabIndex={1}
          name={question.id}
          id={question.id}
          step={"any"}
          placeholder={"Address line 2"}
          required={question.addressLine2Required}
          value={value && value[1] ? (value[1] as string) : ""}
          onInput={(e) => handleInputChange(e.currentTarget.value, 1)}
          autoFocus={autoFocus}
          className="border-border bg-survey-bg focus:border-border-highlight block w-full rounded-md border p-2 shadow-sm focus:outline-none focus:ring-0 sm:text-sm"
        />
      </div>

      <div className="mt-4">
        <input
          tabIndex={1}
          name={question.id}
          id={question.id}
          step={"any"}
          placeholder={"City / Town"}
          required={question.cityRequired}
          value={value && value[3] ? (value[3] as string) : ""}
          onInput={(e) => handleInputChange(e.currentTarget.value, 2)}
          autoFocus={autoFocus}
          className="border-border bg-survey-bg focus:border-border-highlight block w-full rounded-md border p-2 shadow-sm focus:outline-none focus:ring-0 sm:text-sm"
        />
      </div>
      <div className="mt-4">
        <input
          tabIndex={1}
          name={question.id}
          id={question.id}
          step={"any"}
          placeholder={"State / Region"}
          required={question.stateRequired}
          value={value && value[4] ? (value[4] as string) : ""}
          onInput={(e) => handleInputChange(e.currentTarget.value, 3)}
          autoFocus={autoFocus}
          className="border-border bg-survey-bg focus:border-border-highlight block w-full rounded-md border p-2 shadow-sm focus:outline-none focus:ring-0 sm:text-sm"
        />
      </div>
      <div className="mt-4">
        <input
          tabIndex={1}
          name={question.id}
          id={question.id}
          step={"any"}
          placeholder={"ZIP / Post Code"}
          required={question.zipRequired}
          value={value && value[5] ? (value[5] as string) : ""}
          onInput={(e) => handleInputChange(e.currentTarget.value, 4)}
          autoFocus={autoFocus}
          className="border-border bg-survey-bg focus:border-border-highlight block w-full rounded-md border p-2 shadow-sm focus:outline-none focus:ring-0 sm:text-sm"
        />
      </div>
      <div className="mt-4">
        <input
          tabIndex={1}
          name={question.id}
          id={question.id}
          step={"any"}
          placeholder={"Country"}
          required={question.countryRequired}
          value={value && value[6] ? (value[6] as string) : ""}
          onInput={(e) => handleInputChange(e.currentTarget.value, 5)}
          autoFocus={autoFocus}
          className="border-border bg-survey-bg focus:border-border-highlight block w-full rounded-md border p-2 shadow-sm focus:outline-none focus:ring-0 sm:text-sm"
        />
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
