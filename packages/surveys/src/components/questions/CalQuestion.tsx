import { TSurveyCalQuestion } from "@formbricks/types/surveys";
import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import { TResponseData } from "@formbricks/types/responses";

import CalEmbed from "@/components/general/CalEmbed";
import { useCallback, useState } from "preact/hooks";
import ThankYouCard from "@/components/general/ThankYouCard";
import { TResponseTtc } from "@formbricks/types/responses";
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

  const [bookingStatus, setBookingStatus] = useState(value);
  const onSuccessfulBooking = useCallback(() => {
    setBookingStatus("Accepted");
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onChange({ [question.id]: bookingStatus });
        const updatedttc = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedttc);
        onSubmit({ [question.id]: bookingStatus }, updatedttc);
      }}
      className="w-full">
      <Headline headline={question.headline} questionId={question.id} />
      {value === "Accepted" ? (
        <ThankYouCard
          headline={"Thank you for booking!"}
          subheader={"To make any changes, please refer to your email to modify your appointment"}
          isRedirectDisabled={true}
          redirectUrl={null}
        />
      ) : (
        <CalEmbed question={question} onSuccessfulBooking={onSuccessfulBooking} value={bookingStatus} />
      )}
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
