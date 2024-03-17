import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import QuestionImage from "@/components/general/QuestionImage";
import Subheader from "@/components/general/Subheader";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { useState } from "preact/hooks";

import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
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

  const safeValue = Array.isArray(value) ? value : ["", "", "", "", "", ""];

  const handleInputChange = (inputValue: string, index: number) => {
    const updatedValue = [...safeValue];
    updatedValue[index] = inputValue;
    onChange({ [question.id]: updatedValue });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtc);
    onSubmit({ [question.id]: value }, updatedTtc);
  };

  const inputPlaceholders = [
    { placeholder: "Address e.g. Bay Street 69", required: question.required || question.addressRequired },
    { placeholder: "Address line 2", required: question.addressLine2Required },
    { placeholder: "City / Town", required: question.cityRequired },
    { placeholder: "State / Region", required: question.stateRequired },
    { placeholder: "ZIP / Post Code", required: question.zipRequired },
    { placeholder: "Country", required: question.countryRequired },
  ];

  return (
    <form key={question.id} onSubmit={handleSubmit} className="w-full">
      {question.imageUrl && <QuestionImage imgUrl={question.imageUrl} />}
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />
      <div className="mt-4 space-y-2">
        {inputPlaceholders.map(({ placeholder, required }, index) => (
          <input
            name={`${question.id}-${index}`}
            id={`${question.id}-${index}`}
            placeholder={placeholder}
            required={required}
            value={safeValue[index] || ""}
            onInput={(e) => handleInputChange(e.currentTarget.value, index)}
            autoFocus={autoFocus && index === 0}
            className="border-border bg-survey-bg focus:border-border-highlight block w-full rounded-md border p-2 shadow-sm focus:outline-none focus:ring-0 sm:text-sm"
          />
        ))}
      </div>
      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && <BackButton backButtonLabel={question.backButtonLabel} onClick={onBack} />}
        <SubmitButton buttonLabel={question.buttonLabel} isLastQuestion={isLastQuestion} onClick={() => {}} />
      </div>
    </form>
  );
}
