import {useState} from "preact/hooks"
import DatePicker from 'react-date-picker';

export function App() {
  const [date, setDate] = useState<Date | null>(null);
  const [datePickerOpen, setDatePickerOpen] = useState(false)

  return (
    <div>
      <div 
        style={{
          border: "1px solid #333",
          padding: "4px"
        }}
      className="input-container" onClick={() => setDatePickerOpen(!datePickerOpen)}>
        <span>
          {date ? date.toLocaleDateString() : "Select a date"}
        </span>
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
            setDate(value as Date)
            // window.selectedDate = value as Date
            const event = new CustomEvent('dateChange', { detail: value });
            window.dispatchEvent(event);
          }}
        />
      </div>
      
    </div>
  );
}
