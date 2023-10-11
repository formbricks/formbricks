import { render } from "preact";
import { App } from "./app.tsx";
import "./index.css";

declare global {
  interface Window {
    initDatePicker: (element: HTMLElement) => void;
  }
}

const init = (element: HTMLElement) => {
  console.log({ element });
  const container = document.createElement("div");
  container.id = "datePickerContainer";
  element.appendChild(container);
  render(<App />, container);
};

window.initDatePicker = init;
