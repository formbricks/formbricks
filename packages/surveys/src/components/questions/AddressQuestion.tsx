import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import Subheader from "@/components/general/Subheader";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { useEffect, useState } from "preact/hooks";

import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
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
  languageCode: string;
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
  languageCode,
  ttc,
  setTtc,
}: AddressQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());
  const [hasFilled, setHasFilled] = useState(false);
  const isMediaAvailable = question.imageUrl || question.videoUrl;

  useTtc(question.id, ttc, setTtc, startTime, setStartTime);

  const safeValue = Array.isArray(value) ? value : ["", "", "", "", "", ""];

  const handleInputChange = (inputValue: string, index: number) => {
    const updatedValue = [...safeValue];
    updatedValue[index] = inputValue.trimStart();
    onChange({ [question.id]: updatedValue });
  };

  const handleSubmit = (e: Event) => {
    e.preventDefault();
    const updatedTtc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedTtc);
    onSubmit({ [question.id]: value }, updatedTtc);
  };

  useEffect(() => {
    const filled = safeValue.some((val) => val.trim().length > 0);
    setHasFilled(filled);
  }, [value]);

  const inputConfig = [
    {
      placeholder: "Address Line 1 e.g. Bay Street 69",
      required: question.required
        ? hasFilled
          ? question.addressLine1Required
          : true
        : hasFilled
          ? question.addressLine1Required
          : false,
    },
    {
      placeholder: "Address line 2",
      required: question.required
        ? question.addressLine2Required
        : hasFilled
          ? question.addressLine2Required
          : false,
    },
    {
      placeholder: "City / Town",
      required: question.required ? question.cityRequired : hasFilled ? question.cityRequired : false,
    },
    {
      placeholder: "State / Region",
      required: question.required ? question.stateRequired : hasFilled ? question.stateRequired : false,
    },
    {
      placeholder: "ZIP / Post Code",
      required: question.required ? question.zipRequired : hasFilled ? question.zipRequired : false,
    },
    {
      placeholder: "Country",
      required: question.required ? question.countryRequired : hasFilled ? question.countryRequired : false,
    },
  ];

  return (
    <form key={question.id} onSubmit={handleSubmit} className="w-full">
      {isMediaAvailable && <QuestionMedia imgUrl={question.imageUrl} videoUrl={question.videoUrl} />}
      <Headline
        headline={getLocalizedValue(question.headline, languageCode)}
        questionId={question.id}
        required={question.required}
      />
      <Subheader
        subheader={question.subheader ? getLocalizedValue(question.subheader, languageCode) : ""}
        questionId={question.id}
      />
      <div className="mt-4 space-y-2">
        {inputConfig.map(({ placeholder, required }, index) => (
          <input
            name={`${question.id}-${index}`}
            id={`${question.id}-${index}`}
            placeholder={placeholder}
            tabIndex={index + 1}
            required={required}
            value={safeValue[index] || ""}
            onInput={(e) => handleInputChange(e.currentTarget.value, index)}
            autoFocus={autoFocus && index === 0}
            className="border-border bg-survey-bg focus:border-border-highlight block w-full rounded-md border p-2 shadow-sm focus:outline-none focus:ring-0 sm:text-sm"
          />
        ))}
      </div>
      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            tabIndex={8}
            backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
            onClick={() => {
              const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
              setTtc(updatedttc);
              onBack();
            }}
          />
        )}
        <div></div>
        <SubmitButton
          tabIndex={7}
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
          isLastQuestion={isLastQuestion}
          onClick={() => {}}
        />
      </div>
    </form>
  );
}
