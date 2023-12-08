import { useCallback, useState } from "preact/hooks";

import { TSurveyCalQuestion } from "@formbricks/types/surveys";
import { TResponseData } from "@formbricks/types/responses";
import { TResponseTtc } from "@formbricks/types/responses";

import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import CalEmbed from "@/components/general/CalEmbed";

import { getUpdatedTtc, useTtc } from "@/lib/ttc";

interface CalQuestionProps {
  question: TSurveyCalQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
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
      <Headline headline={question.headline} questionId={question.id} />

      <>
        {errorMessage && <span className="text-red-500">{errorMessage}</span>}
        <CalEmbed question={question} onSuccessfulBooking={onSuccessfulBooking} />
      </>

      {/* {value === "booked" ? (
        <div className="rounded-lg border border-slate-200 p-4">
          <ThankYouCard
            headline={"Thank you for booking!"}
            subheader={"To make any changes, please refer to your email to modify your appointment"}
            isRedirectDisabled={true}
            redirectUrl={null}
          />
        </div>
      ) : (
        
      )} */}

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
        <SubmitButton buttonLabel={question.buttonLabel} isLastQuestion={isLastQuestion} onClick={() => {}} />
      </div>
    </form>
  );
}
