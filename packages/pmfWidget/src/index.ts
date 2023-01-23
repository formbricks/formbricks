import { formHtml } from "./form-html";
import formCss from "./form.css";

export interface FormbricksConfig {
  formbricksUrl: string;
  formid?: string;
  divId: string;
  customer?: Record<any, any>;
  style?: any;
}

const config: FormbricksConfig = {
  formbricksUrl: "https://apps.formbricks.com",
  divId: "formbricks",
  customer: {},
  // Merge existing config
  ...(window as any).formbricks?.config,
};

window.addEventListener("load", init);
const formContainer = document.createElement("div");
formContainer.id = "formbricks-container";

function init() {
  // add css to head
  const styleElement = document.createElement("style");
  styleElement.id = "formbricks__css";
  styleElement.innerHTML = formCss;
  document.head.insertBefore(styleElement, document.head.firstChild);

  // add div content
  const div = document.getElementById(config.divId);
  if (div === null) {
    throw new Error(`No div with id ${config.divId} found`);
  }
  div.appendChild(formContainer);
  formContainer.innerHTML = formHtml;
}
