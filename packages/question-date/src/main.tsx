import { render } from "preact";
import App from "./components/app.tsx";
import globalCss from "./styles/globals.css?inline";
import calendarCss from "react-calendar/dist/Calendar.css?inline";

declare global {
  interface Window {
    initDatePicker: (element: HTMLElement) => void;
    selectedDate: Date;
  }
}

const addStylesToDom = () => {
  if (document.getElementById("formbricks__question_date_css") === null) {
    const styleElement = document.createElement("style");
    styleElement.id = "formbricks__question_date_css";
    styleElement.innerHTML = globalCss + calendarCss;
    document.head.appendChild(styleElement);
  }
};

const init = (element: HTMLElement) => {
  addStylesToDom();
  const container = document.createElement("div");
  container.id = "datePickerContainer";
  element.appendChild(container);
  render(<App />, container);
};

// render(<App />, document.getElementById("dpc")!);

window.initDatePicker = init;
