import { useEffect, useMemo, useState } from "preact/hooks";
import DatePicker, { DatePickerProps } from "react-date-picker";
import { useTranslation } from "react-i18next";
import { type TResponseData, type TResponseTtc } from "@formbricks/types/responses";
import type { TSurveyDateElement } from "@formbricks/types/surveys/elements";
import { ElementMedia } from "@/components/general/element-media";
import { Headline } from "@/components/general/headline";
import { Subheader } from "@/components/general/subheader";
import { getMonthName, getOrdinalDate } from "@/lib/date-time";
import { getLocalizedValue } from "@/lib/i18n";
import { getUpdatedTtc, useTtc } from "@/lib/ttc";
import { cn } from "@/lib/utils";
import "../../styles/date-picker.css";

interface DateElementProps {
  element: TSurveyDateElement;
  value: string;
  onChange: (responseData: TResponseData) => void;
  autoFocus?: boolean;
  languageCode: string;
  ttc: TResponseTtc;
  setTtc: (ttc: TResponseTtc) => void;
  autoFocusEnabled: boolean;
  currentElementId: string;
}

function CalendarIcon() {
  return (
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
      className="lucide lucide-calendar-days">
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
}

function CalendarCheckIcon() {
  return (
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
      className="lucide lucide-calendar-check">
      <path d="M8 2v4" />
      <path d="M16 2v4" />
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18" />
      <path d="m9 16 2 2 4-4" />
    </svg>
  );
}

export function DateElement({
  element,
  value,
  onChange,
  languageCode,
  setTtc,
  ttc,
  currentElementId,
}: Readonly<DateElementProps>) {
  const [startTime, setStartTime] = useState(performance.now());
  const [errorMessage, setErrorMessage] = useState("");
  const isMediaAvailable = element.imageUrl || element.videoUrl;
  useTtc(element.id, ttc, setTtc, startTime, setStartTime, element.id === currentElementId);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(value ? new Date(value) : undefined);
  const [hideInvalid, setHideInvalid] = useState(!selectedDate);

  const { t } = useTranslation();

  useEffect(() => {
    if (datePickerOpen) {
      if (!selectedDate) setSelectedDate(new Date());
      const input: HTMLInputElement = document.querySelector(".react-date-picker__inputGroup__input")!;
      if (input) {
        input.focus();
      }
    }
  }, [datePickerOpen, selectedDate]);

  useEffect(() => {
    if (selectedDate) {
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
      key={element.id}
      onSubmit={(e) => {
        e.preventDefault();

        // Validate required field
        if (element.required && !value) {
          setErrorMessage(t("errors.please_select_a_date"));
          return;
        }

        setErrorMessage("");
        const updatedTtcObj = getUpdatedTtc(ttc, element.id, performance.now() - startTime);
        setTtc(updatedTtcObj);
      }}
      className="fb-w-full">
      {isMediaAvailable ? <ElementMedia imgUrl={element.imageUrl} videoUrl={element.videoUrl} /> : null}
      <Headline
        headline={getLocalizedValue(element.headline, languageCode)}
        elementId={element.id}
        required={element.required}
      />
      <Subheader
        subheader={element.subheader ? getLocalizedValue(element.subheader, languageCode) : ""}
        elementId={element.id}
      />
      <div id="error-message" className="fb-text-red-600" aria-live="assertive">
        <span>{errorMessage}</span>
      </div>
      <div
        className={cn("fb-mt-4 fb-w-full", errorMessage && "fb-rounded-lg fb-border-2 fb-border-red-500")}
        id="date-picker-root">
        <div className="fb-relative">
          {!datePickerOpen && (
            <button
              onClick={() => {
                setDatePickerOpen(true);
              }}
              tabIndex={0}
              type="button"
              onKeyDown={(e) => {
                if (e.key === " ") setDatePickerOpen(true);
              }}
              aria-label={
                selectedDate
                  ? t("common.you_have_selected_x_date", { date: formattedDate })
                  : t("common.select_a_date")
              }
              aria-describedby={errorMessage ? "error-message" : undefined}
              className="focus:fb-outline-brand fb-bg-input-bg hover:fb-bg-input-bg-selected fb-border-border fb-text-heading fb-rounded-custom fb-relative fb-flex fb-h-[12dvh] fb-w-full fb-cursor-pointer fb-appearance-none fb-items-center fb-justify-center fb-border fb-text-left fb-text-base fb-font-normal">
              <div className="fb-flex fb-items-center fb-gap-2">
                {selectedDate ? (
                  <div className="fb-flex fb-items-center fb-gap-2">
                    <CalendarCheckIcon /> <span>{formattedDate}</span>
                  </div>
                ) : (
                  <div className="fb-flex fb-items-center fb-gap-2">
                    <CalendarIcon /> <span>{t("common.select_a_date")}</span>
                  </div>
                )}
              </div>
            </button>
          )}

          <DatePicker
            key={datePickerOpen}
            value={selectedDate}
            isOpen={datePickerOpen}
            onChange={(value) => {
              const date = value as Date;

              if (!date) {
                if (element.required) {
                  setErrorMessage(t("errors.please_select_a_date"));
                }
                return;
              }

              setErrorMessage("");
              setSelectedDate(date);

              // Get the timezone offset in minutes and convert it to milliseconds
              const timezoneOffset = date.getTimezoneOffset() * 60000;

              // Adjust the date by subtracting the timezone offset
              const adjustedDate = new Date(date.getTime() - timezoneOffset);

              // Format the date as YYYY-MM-DD
              const dateString = adjustedDate.toISOString().split("T")[0];

              onChange({ [element.id]: dateString });
            }}
            minDate={new Date(new Date().getFullYear() - 100, new Date().getMonth(), new Date().getDate())}
            maxDate={new Date("3000-12-31")}
            dayPlaceholder="DD"
            monthPlaceholder="MM"
            yearPlaceholder="YYYY"
            format={element.format ?? "M-d-y"}
            className={`dp-input-root fb-rounded-custom wrapper-hide ${!datePickerOpen ? "" : "fb-h-[46dvh] sm:fb-h-[34dvh]"} ${hideInvalid ? "hide-invalid" : ""} `}
            calendarProps={{
              className:
                "calendar-root !fb-text-heading !fb-bg-input-bg fb-border fb-border-border fb-rounded-custom fb-p-3 fb-h-[46dvh] sm:fb-h-[33dvh] fb-overflow-auto",
              tileClassName: ({ date }: { date: Date }) => {
                const baseClass =
                  "hover:fb-bg-input-bg-selected fb-rounded-custom fb-h-9 fb-p-0 fb-mt-1 fb-font-normal aria-selected:fb-opacity-100 focus:fb-ring-2 focus:fb-bg-slate-200";
                // active date class (check first to take precedence over today's date)
                if (
                  selectedDate &&
                  date.getDate() === selectedDate?.getDate() &&
                  date.getMonth() === selectedDate.getMonth() &&
                  date.getFullYear() === selectedDate.getFullYear()
                ) {
                  return `${baseClass} !fb-bg-brand !fb-border-border-highlight !fb-text-calendar-tile`;
                }
                // today's date class
                if (
                  date.getDate() === new Date().getDate() &&
                  date.getMonth() === new Date().getMonth() &&
                  date.getFullYear() === new Date().getFullYear()
                ) {
                  return `${baseClass} !fb-bg-brand !fb-opacity-50 !fb-border-border-highlight !fb-text-calendar-tile focus:fb-ring-2 focus:fb-bg-slate-200`;
                }

                return `${baseClass} !fb-text-heading`;
              },
              formatShortWeekday: (_: any, date: Date) => {
                return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
              },
              showNeighboringMonth: false,
            }}
            clearIcon={null}
            onCalendarOpen={() => {
              setDatePickerOpen(true);
            }}
            onCalendarClose={() => {
              // reset state
              setDatePickerOpen(false);
              setSelectedDate(selectedDate);
            }}
            calendarIcon={(<CalendarIcon />) as DatePickerProps["calendarIcon"]}
            showLeadingZeros={false}
          />
        </div>
      </div>
    </form>
  );
}
