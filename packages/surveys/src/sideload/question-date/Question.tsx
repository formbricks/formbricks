import { useEffect, useMemo, useState } from "preact/hooks";
import DatePicker from "react-date-picker";

const CalendarIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
    <path d="M12.75 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM7.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM8.25 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM9.75 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM10.5 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM12.75 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM14.25 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 17.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 15.75a.75.75 0 100-1.5.75.75 0 000 1.5zM15 12.75a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM16.5 13.5a.75.75 0 100-1.5.75.75 0 000 1.5z" />
    <path
      fill-rule="evenodd"
      d="M6.75 2.25A.75.75 0 017.5 3v1.5h9V3A.75.75 0 0118 3v1.5h.75a3 3 0 013 3v11.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V7.5a3 3 0 013-3H6V3a.75.75 0 01.75-.75zm13.5 9a1.5 1.5 0 00-1.5-1.5H5.25a1.5 1.5 0 00-1.5 1.5v7.5a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5v-7.5z"
      clip-rule="evenodd"
    />
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

    if (format === "M-d-y") {
      return `${selectedDate?.getMonth() + 1}-${selectedDate?.getDate()}-${selectedDate?.getFullYear()}`;
    }

    if (format === "d-M-y") {
      return `${selectedDate?.getDate()}-${selectedDate?.getMonth() + 1}-${selectedDate?.getFullYear()}`;
    }

    return `${selectedDate?.getFullYear()}-${selectedDate?.getMonth() + 1}-${selectedDate?.getDate()}`;
  }, [format, selectedDate]);

  return (
    <div className="relative h-12">
      {!datePickerOpen && (
        <div
          onClick={() => setDatePickerOpen(true)}
          className="relative flex h-12 w-full cursor-pointer appearance-none items-center justify-center rounded-lg border border-slate-300 bg-white text-left text-base font-normal text-slate-900 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1">
          <div className="flex items-center gap-2">
            <CalendarIcon />
            <span>{selectedDate ? formattedDate : "Select a date"}</span>
          </div>
        </div>
      )}
      {/* @ts-ignore */}
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
        className={`dp-input-root rounded-lg ${!datePickerOpen ? "wrapper-hide" : ""}
          ${hideInvalid ? "hide-invalid" : ""}
        `}
        calendarClassName="calendar-root w-80 rounded-lg border border-[#e5e7eb] p-3 shadow-md"
        clearIcon={null}
        onCalendarOpen={() => {
          setDatePickerOpen(true);
        }}
        onCalendarClose={() => {
          // reset state
          setDatePickerOpen(false);
          setSelectedDate(selectedDate);
        }}
        // @ts-ignore
        calendarIcon={<CalendarIcon />}
        tileClassName={({ date }) => {
          const baseClass =
            "hover:bg-slate-200 rounded-md h-9 p-0 mt-1 font-normal text-slate-900 aria-selected:opacity-100";
          // today's date class
          if (
            date.getDate() === new Date().getDate() &&
            date.getMonth() === new Date().getMonth() &&
            date.getFullYear() === new Date().getFullYear()
          ) {
            return `${baseClass} bg-slate-100`;
          }
          // active date class
          if (
            date.getDate() === selectedDate?.getDate() &&
            date.getMonth() === selectedDate?.getMonth() &&
            date.getFullYear() === selectedDate?.getFullYear()
          ) {
            return `${baseClass} !bg-slate-900 !text-slate-100`;
          }

          return baseClass;
        }}
        formatShortWeekday={(_, date) => {
          return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
        }}
        showNeighboringMonth={false}
        showLeadingZeros={false}
      />
    </div>
  );
}
