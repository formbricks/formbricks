import { BackButton } from "@/components/buttons/BackButton";
import { SubmitButton } from "@/components/buttons/SubmitButton";
import { Headline } from "@/components/general/Headline";
import { QuestionMedia } from "@/components/general/QuestionMedia";
import { Subheader } from "@/components/general/Subheader";
import { ScrollableContainer } from "@/components/wrappers/ScrollableContainer";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState } from "preact/hooks";
import DatePicker from "react-date-picker";

import { getLocalizedValue } from "@formbricks/lib/i18n/utils";
import { getMonthName, getOrdinalDate } from "@formbricks/lib/utils/datetime";
import { TResponseData, TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyDateQuestion } from "@formbricks/types/surveys";

import "../../styles/date-picker.css";

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
  currentQuestionId: string;
}

const CalendarIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    class="lucide lucide-calendar-days">
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
    <path d="M8 14h.01" />
    <path d="M12 14h.01" />
    <path d="M16 14h.01" />
    <path d="M8 18h.01" />
    <path d="M12 18h.01" />
    <path d="M16 18h.01" />
  </svg>
);

const CalendarCheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    class="lucide lucide-calendar-check">
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
    <path d="m9 16 2 2 4-4" />
  </svg>
);

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
  currentQuestionId,
}: DateQuestionProps) => {
  const [startTime, setStartTime] = useState(performance.now());
  const [errorMessage, setErrorMessage] = useState("");
  const isMediaAvailable = question.imageUrl || question.videoUrl;
  useTtc(question.id, ttc, setTtc, startTime, setStartTime, question.id === currentQuestionId);

  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value ? new Date(value) : undefined);
  const [hideInvalid, setHideInvalid] = useState(!selectedDate);

  useEffect(() => {
    if (datePickerOpen) {
      if (!selectedDate) setSelectedDate(new Date());
      const input = document.querySelector(".react-date-picker__inputGroup__input") as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }
  }, [datePickerOpen, selectedDate]);

  useEffect(() => {
    if (!!selectedDate) {
      if (hideInvalid) {
        setHideInvalid(false);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  const formattedDate = useMemo(() => {
    if (!selectedDate) return "";

    const day = selectedDate.getDate();
    const monthIndex = selectedDate.getMonth();
    const year = selectedDate.getFullYear();

    return `${getOrdinalDate(day)} of ${getMonthName(monthIndex)}, ${year}`;
  }, [selectedDate]);

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
        <div>
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
            className={cn("mt-4 w-full", errorMessage && "rounded-lg border-2 border-red-500")}
            id="date-picker-root">
            <div className="relative">
              {!datePickerOpen && (
                <div
                  onClick={() => setDatePickerOpen(true)}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === " ") setDatePickerOpen(true);
                  }}
                  className="focus:outline-brand bg-input-bg hover:bg-input-bg-selected border-border text-heading rounded-custom relative flex h-[12dvh] w-full cursor-pointer appearance-none items-center justify-center border text-left text-base font-normal">
                  <div className="flex items-center gap-2">
                    {selectedDate ? (
                      <div className="flex items-center gap-2">
                        <CalendarCheckIcon /> <span>{formattedDate}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <CalendarIcon /> <span>Select a date</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <DatePicker
                key={datePickerOpen}
                value={selectedDate}
                isOpen={datePickerOpen}
                onChange={(value) => {
                  const date = value as Date;
                  setSelectedDate(date);

                  // Get the timezone offset in minutes and convert it to milliseconds
                  const timezoneOffset = date.getTimezoneOffset() * 60000;

                  // Adjust the date by subtracting the timezone offset
                  const adjustedDate = new Date(date.getTime() - timezoneOffset);

                  // Format the date as YYYY-MM-DD
                  const dateString = adjustedDate.toISOString().split("T")[0];

                  onChange({ [question.id]: dateString });
                }}
                minDate={
                  new Date(new Date().getFullYear() - 100, new Date().getMonth(), new Date().getDate())
                }
                maxDate={new Date("3000-12-31")}
                dayPlaceholder="DD"
                monthPlaceholder="MM"
                yearPlaceholder="YYYY"
                format={question.format ?? "M-d-y"}
                className={`dp-input-root rounded-custom wrapper-hide ${!datePickerOpen ? "" : "h-[46dvh] sm:h-[34dvh]"}
          ${hideInvalid ? "hide-invalid" : ""}
        `}
                calendarClassName="calendar-root !bg-input-bg border border-border rounded-custom p-3 h-[46dvh] sm:h-[33dvh] overflow-auto"
                clearIcon={null}
                onCalendarOpen={() => {
                  setDatePickerOpen(true);
                }}
                onCalendarClose={() => {
                  // reset state
                  setDatePickerOpen(false);
                  setSelectedDate(selectedDate);
                }}
                // @ts-expect-error
                calendarIcon={<CalendarIcon />}
                tileClassName={({ date }: { date: Date }) => {
                  const baseClass =
                    "hover:bg-input-bg-selected rounded-custom h-9 p-0 mt-1 font-normal text-heading aria-selected:opacity-100 focus:ring-2 focus:bg-slate-200";
                  // today's date class
                  if (
                    date.getDate() === new Date().getDate() &&
                    date.getMonth() === new Date().getMonth() &&
                    date.getFullYear() === new Date().getFullYear()
                  ) {
                    return `${baseClass} !bg-brand !border-border-highlight !text-heading focus:ring-2 focus:bg-slate-200`;
                  }
                  // active date class
                  if (
                    date.getDate() === selectedDate?.getDate() &&
                    date.getMonth() === selectedDate?.getMonth() &&
                    date.getFullYear() === selectedDate?.getFullYear()
                  ) {
                    return `${baseClass} !bg-brand !border-border-highlight !text-heading`;
                  }

                  return baseClass;
                }}
                formatShortWeekday={(_: any, date: Date) => {
                  return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
                }}
                showNeighboringMonth={false}
                showLeadingZeros={false}
              />
            </div>
          </div>
        </div>
      </ScrollableContainer>
      <div className="flex w-full justify-between px-6 py-4">
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
          tabIndex={0}
        />
      </div>
    </form>
  );
};
