import { h } from "preact";
import { TResponseData } from "../../../types/v1/responses";
import type { TSurveyBookingWithCal } from "../../../types/v1/surveys";
import SubmitButton from "./SubmitButton";
import { BackButton } from "./BackButton";
import Cal from "@calcom/embed-react";

interface BookingWithCalProps {
  question: TSurveyBookingWithCal;
  onSubmit: (data: TResponseData) => void;
  lastQuestion: boolean;
  brandColor: string;
  storedResponseValue: number | null;
  goToNextQuestion: (answer: TResponseData) => void;
  goToPreviousQuestion?: (answer?: TResponseData) => void;
}

export default function BookingWithCal({
  question,
  onSubmit,
  lastQuestion,
  brandColor,
  storedResponseValue,
  goToNextQuestion,
  goToPreviousQuestion,
}: BookingWithCalProps) {
  return (
    <div>
      <Cal
        key={question.label}
        calLink={question.label.length === 0 ? "rick" : question.label}
        config={{
          theme: "light",
        }}
      />

      <div className="fb-mt-4 fb-flex fb-w-full fb-justify-between">
        <div>
          {goToPreviousQuestion && <BackButton onClick={() => goToPreviousQuestion()} />}
        </div>
        <div className="fb-flex fb-justify-end">
          {(!question.required || storedResponseValue) && (
            <button
              type="button"
              onClick={() => {
                if (storedResponseValue) {
                  goToNextQuestion({ [question.id]: "clicked" });
                  return;
                }
                onSubmit({ [question.id]: "dismissed" });
              }}
              className="fb-flex fb-items-center dark:fb-text-slate-400 fb-rounded-md fb-px-3 fb-py-3 fb-text-base fb-font-medium fb-leading-4 fb-hover:opacity-90 fb-focus:outline-none fb-focus:ring-2 fb-focus:ring-slate-500 fb-focus:ring-offset-2 fb-mr-4">
              {typeof storedResponseValue === "string" && storedResponseValue === "clicked"
                ? "Next"
                : "Skip"}
            </button>
          )}
          <SubmitButton
            question={question}
            lastQuestion={lastQuestion}
            brandColor={brandColor}
            onClick={() => {}}
            type="button"
          />
        </div>
      </div>
    </div>
  );
}
