import { useEffect, useMemo, useState } from "preact/hooks";
import DatePicker from "react-date-picker";

const CalendarIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="24"
    height="24"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
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
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    class="lucide lucide-calendar-check">
    <path d="M8 2v4" />
    <path d="M16 2v4" />
    <rect width="18" height="18" x="3" y="4" rx="2" />
    <path d="M3 10h18" />
    <path d="m9 16 2 2 4-4" />
  </svg>
);

export default function Question({ defaultDate, format }: { defaultDate?: Date; format?: string }) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(defaultDate);
  const [hideInvalid, setHideInvalid] = useState(!selectedDate);

  useEffect(() => {
    if (datePickerOpen) {
      const input = document.querySelector(".react-date-picker__inputGroup__input") as HTMLInputElement;
      if (input) {
        input.focus();
      }
    }
  }, [datePickerOpen]);

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

    // Helper function to get the month name
    const getMonthName = (monthIndex: number) => {
      const months = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];
      return months[monthIndex];
    };

    // Helper function to format the date with an ordinal suffix
    const getOrdinalDate = (date: number) => {
      const j = date % 10,
        k = date % 100;
      if (j === 1 && k !== 11) {
        return date + "st";
      }
      if (j === 2 && k !== 12) {
        return date + "nd";
      }
      if (j === 3 && k !== 13) {
        return date + "rd";
      }
      return date + "th";
    };

    const day = selectedDate.getDate();
    const monthIndex = selectedDate.getMonth();
    const year = selectedDate.getFullYear();

    return `${getOrdinalDate(day)} of ${getMonthName(monthIndex)}, ${year}`;
  }, [selectedDate]);

  return (
    <div className="relative">
      {!datePickerOpen && (
        <div
          onClick={() => setDatePickerOpen(true)}
          className="bg-input-bg hover:bg-input-bg-selected border-border text-heading rounded-custom relative flex h-[12dvh] w-full cursor-pointer appearance-none items-center justify-center border text-left text-base font-normal focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1">
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

      {/* @ts-expect-error */}
      <DatePicker
        key={datePickerOpen}
        value={selectedDate}
        isOpen={datePickerOpen}
        onChange={(value) => {
          const event = new CustomEvent("dateChange", { detail: value });
          setSelectedDate(value as Date);
          window.dispatchEvent(event);
        }}
        minDate={new Date(new Date().getFullYear() - 100, new Date().getMonth(), new Date().getDate())}
        maxDate={new Date("3000-12-31")}
        dayPlaceholder="DD"
        monthPlaceholder="MM"
        yearPlaceholder="YYYY"
        format={format ?? "M-d-y"}
        className={`dp-input-root rounded-custom wrapper-hide ${!datePickerOpen ? "" : "h-[34dvh]"}
          ${hideInvalid ? "hide-invalid" : ""}
        `}
        calendarClassName="calendar-root !bg-input-bg border border-border rounded-custom p-3 h-[33dvh] overflow-auto"
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
        tileClassName={({ date }) => {
          const baseClass =
            "hover:bg-input-bg-selected rounded-custom h-9 p-0 mt-1 font-normal text-heading aria-selected:opacity-100";
          // today's date class
          if (
            date.getDate() === new Date().getDate() &&
            date.getMonth() === new Date().getMonth() &&
            date.getFullYear() === new Date().getFullYear()
          ) {
            return `${baseClass} border border-input-border`;
          }
          // active date class
          if (
            date.getDate() === selectedDate?.getDate() &&
            date.getMonth() === selectedDate?.getMonth() &&
            date.getFullYear() === selectedDate?.getFullYear()
          ) {
            return `${baseClass} !bg-accent-selected-bg !border-border-highlight !text-heading`;
          }

          return baseClass;
        }}
        formatShortWeekday={(_, date) => {
          return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
        }}
        navi
        showNeighboringMonth={false}
        showLeadingZeros={false}
      />
    </div>
  );
}
