import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import QuestionImage from "@/components/general/QuestionImage";
import Subheader from "@/components/general/Subheader";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
import { getLocalizedValue } from "@/lib/utils";
import { useEffect, useState } from "preact/hooks";

import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyDateQuestion } from "@formbricks/types/surveys";

interface DateQuestionProps {
  question: TSurveyDateQuestion;
  value: string | number | string[];
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  autoFocus?: boolean;
  language: string;
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
  language,
  setTtc,
  ttc,
}: DateQuestionProps) {
  const [startTime, setStartTime] = useState(performance.now());
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useTtc(question.id, ttc, setTtc, startTime, setStartTime);

  const defaultDate = value ? new Date(value as string) : undefined;
  const datePickerScriptSrc = import.meta.env.DATE_PICKER_SCRIPT_SRC;

  useEffect(() => {
    // Check if the DatePicker has already been loaded

    if (!window.initDatePicker) {
      const script = document.createElement("script");

      script.src = datePickerScriptSrc;

      script.async = true;

      document.body.appendChild(script);

      script.onload = () => {
        // Initialize the DatePicker once the script is loaded
        window.initDatePicker(document.getElementById("date-picker-root")!, defaultDate, question.format);
        setLoading(false);
      };

      return () => {
        document.body.removeChild(script);
      };
    } else {
      // If already loaded, remove the date picker and re-initialize it
      setLoading(false);

      const datePickerContainer = document.getElementById("datePickerContainer");
      if (datePickerContainer) {
        datePickerContainer.remove();
      }

      window.initDatePicker(document.getElementById("date-picker-root")!, defaultDate, question.format);
    }

    return () => {};

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question.format, question.id]);

  useEffect(() => {
    window.addEventListener("dateChange", (e) => {
      // @ts-expect-error
      const date = e.detail as Date;

      // Get the timezone offset in minutes and convert it to milliseconds
      const timezoneOffset = date.getTimezoneOffset() * 60000;

      // Adjust the date by subtracting the timezone offset
      const adjustedDate = new Date(date.getTime() - timezoneOffset);

      // Format the date as YYYY-MM-DD
      const dateString = adjustedDate.toISOString().split("T")[0];

      onChange({ [question.id]: dateString });
    });
  }, [onChange, question.id]);

  useEffect(() => {
    if (value && errorMessage) {
      setErrorMessage("");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (question.required && !value) {
          setErrorMessage("Please select a date.");
          return;
        }
        const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
        onSubmit({ [question.id]: value }, updatedTtcObj);
      }}
      className="w-full">
      {question.imageUrl && <QuestionImage imgUrl={question.imageUrl} />}
      <Headline
        headline={getLocalizedValue(question.headline, language)}
        questionId={question.id}
        required={question.required}
      />
      <Subheader
        subheader={question.subheader ? getLocalizedValue(question.subheader, language) : ""}
        questionId={question.id}
      />

      <div className={"text-red-600"}>
        <span>{errorMessage}</span>
      </div>

      <div className={cn("my-4", errorMessage && "rounded-lg border-2 border-red-500")} id="date-picker-root">
        {loading && (
          <div className="relative flex h-12 w-full cursor-pointer appearance-none items-center justify-center rounded-lg border border-slate-300 bg-white text-left text-base font-normal text-slate-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1">
            <span
              className="h-6 w-6 animate-spin rounded-full border-b-2 border-neutral-900"
              style={{ borderTopColor: "transparent" }}></span>
          </div>
        )}
      </div>

      <div className="mt-4 flex w-full justify-between">
        <div>
          {!isFirstQuestion && (
            <BackButton
              backButtonLabel={getLocalizedValue(question.backButtonLabel, language)}
              onClick={() => {
                const updatedTtcObj = getUpdatedTtc(ttc, question.id, performance.now() - startTime);
                setTtc(updatedTtcObj);
                onBack();
              }}
            />
          )}
        </div>

        <SubmitButton
          isLastQuestion={isLastQuestion}
          onClick={() => {}}
          buttonLabel={getLocalizedValue(question.buttonLabel, language)}
        />
      </div>
    </form>
  );
}
