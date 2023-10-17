import { render } from "preact";
import { App } from "./app.tsx";
import "./app.css?inline"

declare global {
  interface Window {
    initDatePicker: (element: HTMLElement) => void;
    selectedDate: Date;
  }
}

const init = (element: HTMLElement) => {
  const container = document.createElement("div");
  container.id = "datePickerContainer";
  element.appendChild(container);
  render(<App />, container);
};


// render(<App />, document.getElementById("dpc")!)

// init(document.getElementById("date-pick")!)

window.initDatePicker = init
