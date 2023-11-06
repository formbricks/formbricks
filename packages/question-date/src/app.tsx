import { useState } from "preact/hooks";
import DatePicker from "react-date-picker";

export function App() {
  const [date, setDate] = useState<Date | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false);

  return (
    <div>
      <div className="input-container" onClick={() => setDatePickerOpen(!datePickerOpen)}>
        <button
          class="date-pick-btn text-muted-foreground relative flex w-[280px] appearance-none items-center justify-start rounded-md border border-slate-300 bg-white px-6 py-3 text-left text-sm font-normal hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:ring-offset-1 dark:text-slate-700 dark:hover:text-slate-500"
          type="button"
          aria-haspopup="dialog"
          aria-expanded="false"
          aria-controls="radix-:r1o:"
          data-state="closed">
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
          <span>{date ? date.toLocaleDateString() : "Select a date"}</span>
        </button>
      </div>
      <div>
        {/* @ts-ignore */}
        <DatePicker
          value={date}
          isOpen={datePickerOpen}
          clearIcon={null}
          calendarIcon={null}
          onCalendarClose={() => setDatePickerOpen(false)}
          onCalendarOpen={() => setDatePickerOpen(true)}
          onChange={(value) => {
            setDate(value as Date);
            // window.selectedDate = value as Date
            const event = new CustomEvent("dateChange", { detail: value });
            window.dispatchEvent(event);
          }}
        />
      </div>
    </div>
  );
}
