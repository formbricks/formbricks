import { TResponseData } from "@formbricks/types/responses";
import type { TSurveyDateQuestion } from "@formbricks/types/surveys";
import { BackButton } from "./BackButton";
import Headline from "./Headline";
import Subheader from "./Subheader";
import SubmitButton from "./SubmitButton";
import { useEffect, useState } from "preact/hooks";

interface IDateQuestionProps {
  question: TSurveyDateQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  brandColor: string;
  autoFocus?: boolean;
}

export default function DateQuestion({
  question,
  value,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  brandColor,
}: IDateQuestionProps) {
  const [datePickerOpen, _setDatePickerOpen] = useState(true);
  const [date, setDate] = useState(new Date());

  useEffect(() => {
    // Check if the DatePicker has already been loaded

    if (!datePickerOpen) return;

    // @ts-expect-error
    if (!window.initDatePicker) {
      const script = document.createElement("script");
      script.src = "http://localhost:8080/dist/index.js";
      script.async = true;

      document.body.appendChild(script);

      script.onload = () => {
        // Initialize the DatePicker once the script is loaded
        // @ts-expect-error
        window.initDatePicker(document.getElementById("date-pick"));
      };

      return () => {
        document.body.removeChild(script);
      };
    } else {
      // If already loaded, just initialize
      // @ts-ignore
      window.initDatePicker(document.getElementById("date-pick"));
    }

    return () => {};
  }, [datePickerOpen]);

  useEffect(() => {
    window.addEventListener("dateChange", (e) => {
      // @ts-expect-error
      const date = e.detail as Date;
      setDate(date);
    });
  }, []);

  // sync the date with the date picker
  useEffect(() => {
    // @ts-expect-error
    window.selectedDate = date;
  }, [date]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        //  if ( validateInput(value as string, question.inputType, question.required)) {
        onSubmit({ [question.id]: value });
        // }
      }}
      className="w-full">
      <Headline headline={question.headline} questionId={question.id} required={question.required} />
      <Subheader subheader={question.subheader} questionId={question.id} />

      <h1 className="my-4">
        {/* @ts-ignore */}
        You Selected: {date?.toLocaleDateString()}
      </h1>

      <div className="mt-4" id="date-pick"></div>

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
          isLastQuestion={isLastQuestion}
          brandColor={brandColor}
          onClick={() => {}}
          buttonLabel="Submit"
        />
      </div>
    </form>
  );
}
