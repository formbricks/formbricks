import { render } from "preact";
import { App } from "./app.tsx";
import global from "./app.css?inline"
import datePickerCss from 'react-date-picker/dist/DatePicker.css?inline';
import calendarCss from 'react-calendar/dist/Calendar.css?inline';
import  "./app.css"
import  'react-date-picker/dist/DatePicker.css';
import  'react-calendar/dist/Calendar.css';

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
    styleElement.innerHTML = global + datePickerCss + calendarCss
    document.head.appendChild(styleElement);
  }
}

const init = (element: HTMLElement) => {
  addStylesToDom()
  const container = document.createElement("div");
  container.id = "datePickerContainer";
  element.appendChild(container);
  render(<App />, container);
};


render(<App />, document.getElementById("dpc")!)

// init(document.getElementById("date-pick")!)

window.initDatePicker = init
