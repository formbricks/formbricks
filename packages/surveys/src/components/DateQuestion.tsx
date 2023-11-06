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
  // const date = useRef(new Date()).current;

  useEffect(() => {
    // Check if the DatePicker has already been loaded

    if (!datePickerOpen) return;

    // @ts-ignore
    if (!window.initDatePicker) {
      const script = document.createElement("script");
      script.src = "http://localhost:8080/";
      script.async = true;

      document.body.appendChild(script);

      script.onload = () => {
        // Initialize the DatePicker once the script is loaded
        // @ts-ignore
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
    // @ts-ignore
    window.addEventListener("dateChange", (e) => {
      // @ts-ignore
      const date = e.detail as Date;
      // @ts-ignore
      setDate(date);
    });
  }, []);

  // sync the date with the date picker
  useEffect(() => {
    // @ts-ignore
    window.selectedDate = date;
  }, [date]);

  useEffect(() => {
    console.log(date);
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

      <div className="mt-4" id="date-pick">
        {/* From here, the date picker should be opened? */}

        {/* <button
          className="px-3 py-1 rounded-sm bg-slate-800"
          type="button"
          onClick={() => {
            setDatePickerOpen(true);
          }}>
          <span className="text-white">Open date picker</span>
        </button> */}
      </div>

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
