import { render } from "preact";
import { App } from "./app.tsx";
import "./index.css";

// render(<App />, document.getElementById('app')!)

const init = () => {
  const container = document.createElement("div");
  container.id = "datePickerContainer";
  document.body.appendChild(container);
  render(<App />, container);
};

// init();

// Export the initialization function
// @ts-ignore
window.initDatePicker = init;
