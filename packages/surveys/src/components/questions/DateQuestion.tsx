import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import Subheader from "@/components/general/Subheader";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyDateQuestion } from "@formbricks/types/surveys";
import { useEffect, useState } from "preact/hooks";

interface DateQuestionProps {
  question: TSurveyDateQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  autoFocus?: boolean;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
}

export default function DateQuestion({
  question,
  value,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  onChange,
  setTtc,
  ttc,
}: DateQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());

  useTtc(question.id, ttc, setTtc, startTime, setStartTime);

  const [datePickerOpen, _setDatePickerOpen] = useState(true);
  const defaultDate = value ? new Date(value as string) : undefined;

  useEffect(() => {
    // Check if the DatePicker has already been loaded

    if (!datePickerOpen) return;

    if (!window.initDatePicker) {
      const script = document.createElement("script");

      script.src =
        process.env.NODE_ENV === "production"
          ? "https://unpkg.com/@formbricks/surveys@%5E1.0.0/dist/question-date.umd.js"
          : "http://localhost:3003/question-date.umd.js";

      script.async = true;

      document.body.appendChild(script);

      script.onload = () => {
        // Initialize the DatePicker once the script is loaded
        // @ts-expect-error
        window.initDatePicker(document.getElementById("date-picker-root"), defaultDate, question.format);
      };

      return () => {
        document.body.removeChild(script);
      };
    } else {
      // If already loaded, remove the date picker and re-initialize it

      const datePickerContainer = document.getElementById("datePickerContainer");
      if (datePickerContainer) {
        datePickerContainer.remove();
      }

      // @ts-ignore
      window.initDatePicker(document.getElementById("date-picker-root"), defaultDate, question.format);
    }

    return () => {};

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePickerOpen, question.format]);

  useEffect(() => {
    window.addEventListener("dateChange", (e) => {
      // @ts-expect-error
      const date = e.detail as Date;
      onChange({ [question.id]: date.toDateString() });
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (question.required && !value) {
          alert("Please select a date");
          return;
        }
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value }, updatedTtcObj);
      }}
      className="w-full">
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />

      <div className="my-4" id="date-picker-root"></div>

      <div className="mt-4 flex w-full justify-between">
        <div>
          {!isFirstQuestion && (
            <BackButton
              backButtonLabel={question.backButtonLabel}
              onClick={() => {
                const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                setTtc(updatedTtcObj);
                onBack();
              }}
            />
          )}
        </div>

        <SubmitButton isLastQuestion={isLastQuestion} onClick={() => {}} buttonLabel={question.buttonLabel} />
      </div>
    </form>
  );
}
