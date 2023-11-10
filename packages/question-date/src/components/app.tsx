import { useState } from "preact/hooks";
import DatePicker from "react-date-picker";

export default function App({ defaultDate }: { defaultDate?: Date }) {
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date>(defaultDate || new Date());

  return (
    <div className="flex flex-col gap-2 p-4">
      <div>
        <div>
          {!datePickerOpen && (
            <div
              onClick={() => setDatePickerOpen(true)}
              class="relative flex w-fit cursor-pointer appearance-none items-center justify-start rounded-md border border-slate-300 bg-white px-6 py-3 text-left text-sm font-normal hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1 dark:text-slate-700 dark:hover:text-slate-500">
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
          )}
        </div>

        {/* @ts-ignore */}

        <DatePicker
          value={selectedDate}
          isOpen={datePickerOpen}
          onChange={(value) => {
            const event = new CustomEvent("dateChange", { detail: value });
            setSelectedDate(value as Date);
            window.dispatchEvent(event);
          }}
          className={`dp-input-root rounded-lg ${!datePickerOpen ? "wrapper-hide" : ""}`}
          calendarClassName="date-picker-root w-80 rounded-lg border border-[#e5e7eb] p-3 shadow-md"
          clearIcon={null}
          onCalendarClose={() => setDatePickerOpen(false)}
          // @ts-ignore
          calendarIcon={
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
          }
          tileClassName={({ date }) => {
            const baseClass =
              "hover:bg-slate-200 rounded-md h-9 p-0 mt-1 font-normal text-slate-900 aria-selected:opacity-100";

            // today's date class
            if (
              date.getDate() === new Date().getDate() &&
              date.getMonth() === new Date().getMonth() &&
              date.getFullYear() === new Date().getFullYear()
            ) {
              return baseClass + " !bg-slate-100 !text-slate-900";
            }

            // active date class
            if (
              date.getDate() === selectedDate?.getDate() &&
              date.getMonth() === selectedDate?.getMonth() &&
              date.getFullYear() === selectedDate?.getFullYear()
            ) {
              return baseClass + " !bg-slate-900 !text-slate-100";
            }

            return baseClass;
          }}
          formatShortWeekday={(_, date) => {
            return date.toLocaleDateString("en-US", { weekday: "short" }).slice(0, 2);
          }}
          showNeighboringMonth={false}
        />
      </div>
    </div>
  );
}
