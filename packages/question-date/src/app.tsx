import DatePicker from 'react-date-picker';
import 'react-date-picker/dist/DatePicker.css?inline';
import 'react-calendar/dist/Calendar.css?inline';

export function App() {
  return (
    <div>
      {/* @ts-ignore */}
      <DatePicker 
        value={new Date()}
        isOpen
        autoFocus
        closeCalendar={false}
        shouldCloseCalendar={() => false}
        onChange={(value) => {
          console.log(value)
          // window.selectedDate = value as Date
          const event = new CustomEvent('dateChange', { detail: value });
          window.dispatchEvent(event);
        }}
      />
    </div>
  );
}
