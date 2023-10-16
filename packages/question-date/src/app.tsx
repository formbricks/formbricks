import {useState} from "preact/hooks"
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

export function App() {
  const [open, setOpen] = useState(true)

  return (
    <div>
      hello
      <DayPicker />
      {/* <button onClick={() => setOpen(true)}>Open</button> */}
      {/* {open && <DayPicker mode="single" />} */}
    </div>
  );
}
