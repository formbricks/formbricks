import { BackButton } from "@/components/buttons/BackButton";
import SubmitButton from "@/components/buttons/SubmitButton";
import Headline from "@/components/general/Headline";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import Subheader from "@/components/general/Subheader";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
import { useEffect, useState } from "preact/hooks";

import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyDateQuestion } from "@formbricks/types/surveys";

import { initDatePicker } from "../../sideload/question-date/index";

interface DateQuestionProps {
  question: TSurveyDateQuestion;
  value: string;
  onChange: (responseData: TResponseData) => void;
  onSubmit: (data: TResponseData, ttc: TResponseTtc) => void;
  onBack: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  autoFocus?: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  isInIframe: boolean;
}

export const DateQuestion = ({
  question,
  value,
  onSubmit,
  onBack,
  isFirstQuestion,
  isLastQuestion,
  onChange,
  languageCode,
  setTtc,
  ttc,
}: DateQuestionProps) => {
  const [startTime, setStartTime] = useState(performance.now());
  const [errorMessage, setErrorMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const isMediaAvailable = question.imageUrl || question.videoUrl;

  useTtc(question.id, ttc, setTtc, startTime, setStartTime);

  const defaultDate = value ? new Date(value as string) : undefined;
  useEffect(() => {
    initDatePicker(document.getElementById("date-picker-root")!, defaultDate, question.format);
    setLoading(false);

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
      key={question.id}
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
      <ScrollableContainer>
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
        <div className={"text-red-600"}>
          <span>{errorMessage}</span>
        </div>
        <div
          className={cn("my-4", errorMessage && "rounded-lg border-2 border-red-500")}
          id="date-picker-root">
          {loading && (
            <div className="bg-survey-bg border-border text-placeholder relative flex h-12 w-full cursor-pointer appearance-none items-center justify-center rounded-lg border text-left text-base font-normal focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1">
              <span
                className="h-6 w-6 animate-spin rounded-full border-b-2 border-neutral-900"
                style={{ borderTopColor: "transparent" }}></span>
            </div>
          )}
        </div>
      </ScrollableContainer>
      <div className="flex w-full justify-between px-6">
        <div>
          {!isFirstQuestion && (
            <BackButton
              backButtonLabel={getLocalizedValue(question.backButtonLabel, languageCode)}
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
          buttonLabel={getLocalizedValue(question.buttonLabel, languageCode)}
        />
      </div>
    </form>
  );
};
