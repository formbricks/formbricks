import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import CalEmbed from "@/components/general/CalEmbed";
import Headline from "@/components/general/Headline";
import Subheader from "@/components/general/Subheader";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { getLocalizedValue } from "@/lib/utils";
import { useCallback, useState } from "preact/hooks";

import { TResponseData } from "@formbricks/types/responses";
import { TResponseTtc } from "@formbricks/types/responses";
import { TSurveyCalQuestion } from "@formbricks/types/surveys";

interface CalQuestionProps {
  question: TSurveyCalQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  language: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
}

export default function CalQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  language,
  ttc,
  setTtc,
}: CalQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());
  useTtc(question.id, ttc, setTtc, startTime, setStartTime);

  const [errorMessage, setErrorMessage] = useState("");

  const onSuccessfulBooking = useCallback(() => {
    onChange({ [question.id]: "booked" });
    const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
    setTtc(updatedttc);
    onSubmit({ [question.id]: "booked" }, updatedttc);
  }, [onChange, onSubmit, question.id, setTtc, startTime, ttc]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (question.required && !value) {
          setErrorMessage("Please book an appointment");
          return;
        }

        const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedttc);

        onChange({ [question.id]: value });
        onSubmit({ [question.id]: value }, updatedttc);
      }}
      className="w-full">
      <Headline
        headline={getLocalizedValue(question.headline, language)}
        questionId={question.id}
        required={question.required}
      />
      <Subheader
        subheader={question.subheader ? getLocalizedValue(question.subheader, language) : ""}
        questionId={question.id}
      />
      <>
        {errorMessage && <span className="text-red-500">{errorMessage}</span>}
        <CalEmbed key={question.id} question={question} onSuccessfulBooking={onSuccessfulBooking} />
      </>

      <div className="mt-4 flex w-full justify-between">
        {!isFirstQuestion && (
          <BackButton
            backButtonLabel={getLocalizedValue(question.backButtonLabel, language)}
            onClick={() => {
              onBack();
            }}
          />
        )}
        <div></div>
        {!question.required && (
          <SubmitButton
            buttonLabel={getLocalizedValue(question.buttonLabel, language)}
            isLastQuestion={isLastQuestion}
            onClick={() => {}}
          />
        )}
      </div>
    </form>
  );
}
