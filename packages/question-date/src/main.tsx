import { render } from "preact";
import { App } from "./app.tsx";
import "./index.css";

declare global {
  interface Window {
    initDatePicker: () => void;
  }
}

const init = () => {
  const container = document.createElement("div");
  container.id = "datePickerContainer";
  document.body.appendChild(container);
  render(<App />, container);
};

window.initDatePicker = init;
