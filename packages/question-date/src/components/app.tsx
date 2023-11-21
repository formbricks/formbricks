import { useState } from "preact/hooks";
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
    className="cal-icon mr-2 h-4 w-4">
    <rect width="18" height="18" x="3" y="4" rx="2" ry="2"></rect>
    <line x1="16" x2="16" y1="2" y2="6"></line>
    <line x1="8" x2="8" y1="2" y2="6"></line>
    <line x1="3" x2="21" y1="10" y2="10"></line>
  </svg>
);

export default function App({ defaultDate }: { defaultDate?: Date }) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(defaultDate);

  return (
    <div className="flex flex-col gap-1">
      <div>
        {!datePickerOpen && (
          <div
            onClick={() => setDatePickerOpen(true)}
            class="relative flex h-10 w-[180px] cursor-pointer appearance-none items-center justify-center rounded-lg border border-slate-300 bg-white text-left text-sm font-normal text-slate-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1">
            <div className="flex items-center">
              <CalendarIcon />
              <span>
                {selectedDate
                  ? selectedDate?.toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })
                  : "Select a date"}
              </span>
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
          format="M-d-y"
          className={`dp-input-root rounded-lg ${!datePickerOpen ? "wrapper-hide" : ""}`}
          calendarClassName="date-picker-root w-80 rounded-lg border border-[#e5e7eb] p-3 shadow-md"
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
              return baseClass + " bg-slate-100";
            }
            // active date class
            if (
              date.getDate() === selectedDate?.getDate() &&
              date.getMonth() === selectedDate?.getMonth() &&
              date.getFullYear() === selectedDate?.getFullYear()
            ) {
              return baseClass + " bg-slate-900 !text-slate-100";
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
    </div>
  );
}
