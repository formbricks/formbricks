import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

export function App() {
  return (
    <div style={{ margin: "200px" }}>
      <h1>
        Hello from <code>question-date</code>!
      </h1>
      <DayPicker />
    </div>
  );
}
