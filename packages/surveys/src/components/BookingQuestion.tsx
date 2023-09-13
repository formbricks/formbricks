import { TResponseData } from "@formbricks/types/v1/responses";
import type { TSurveyBookingQuestion } from "@formbricks/types/v1/surveys";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import SubmitButton from "./SubmitButton";
import Calendar from "./Calender";
import { useCallback, useState } from "preact/hooks";
import ThankYouCard from "./ThankYouCard";

interface BookingQuestionProps {
  question: TSurveyBookingQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
}

export default function BookingQuestion({
  question,
  value,
  onChange,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
}: BookingQuestionProps) {
  const [bookingStatus, setBookingStatus] = useState(value);
  const onSuccessfulBooking = useCallback(() => {
    // The first argument in this callback is the data from the booking, with the values from bookingSuccessful:
    // https://github.com/calcom/cal.com/blob/main/packages/embeds/embed-core/src/sdk-action-manager.ts#L25-L37
    // For now, we're just setting the booking status to "Accepted" for the summary to avoid excess info dumping
    setBookingStatus("Accepted");
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onChange({ [question.id]: bookingStatus });
        onSubmit({ [question.id]: bookingStatus });
      }}
      className="w-full">
      <Headline headline={question.headline} questionId={question.id} />
      {value === "Accepted" ? (
        <ThankYouCard
          headline={"Thank you for booking!"}
          subheader={"To make any changes, please refer to your email to modify your appointment"}
          isRedirectDisabled={true}
          brandColor={brandColor}
          questionId={question.id}
          redirectUrl={null}
        />
      ) : (
        <Calendar
          question={question}
          brandColor={brandColor}
          onSuccessfulBooking={onSuccessfulBooking}
          value={bookingStatus}
        />
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
