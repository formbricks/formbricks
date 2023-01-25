import { formHtml } from "./form-html";
import formCss from "./form.css";

export interface FormbricksConfig {
  formbricksUrl: string;
  formId?: string;
  containerId: string;
  customer?: Record<any, any>;
  style?: any;
}

const config: FormbricksConfig = {
  formbricksUrl: "https://app.formbricks.com",
  containerId: "formbricks",
  customer: {},
  // Merge existing config
  ...(window as any).formbricks?.config,
};

let submission: any = {};
let currentElementIdx = 0;
let submissionId: null | string = null;

window.addEventListener("load", init);
const formContainer = document.createElement("div");
formContainer.id = "formbricks-container";

function init() {
  // add css to head
  const styleElement = document.createElement("style");
  styleElement.id = "formbricks__css";
  styleElement.innerHTML = formCss;
  document.head.appendChild(styleElement);

  // add div content
  const div = document.getElementById(config.containerId);
  if (div === null) {
    throw new Error(`No div with id ${config.containerId} found`);
  }
  div.appendChild(formContainer);
  formContainer.innerHTML = formHtml;

  applyConfig();

  // add listeners
  // radio buttons
  Array.from(
    formContainer.getElementsByClassName("formbricks-radio-option") as HTMLCollectionOf<HTMLElement>
  ).forEach((el) => {
    el.addEventListener("click", () => submitElement(el.dataset?.elementName, el.dataset?.elementValue));
  });
  // text inputs
  Array.from(
    formContainer.getElementsByClassName("formbricks-form") as HTMLCollectionOf<HTMLFormElement>
  ).forEach((el) => {
    el.onsubmit = (e: SubmitEvent) => {
      e.preventDefault();
      // @ts-ignore
      submitElement(el.dataset?.elementName, e.target.elements[el.dataset?.elementName].value);
    };
  });
}

function applyConfig() {
  if (config.style) {
    const root = document.querySelector(":root") as HTMLElement;
    if (root !== null) {
      if (config.style.brandColor) {
        root.style.setProperty("--formbricks-brand-color", config.style.brandColor);
        root.style.setProperty("--formbricks-brand-color-transparent", config.style.brandColor + 50);
      }
      if (config.style.headerBGColor) {
        root.style.setProperty("--formbricks-header-bg-color", config.style.headerBGColor);
      }
      if (config.style.headerTitleColor) {
        root.style.setProperty("--formbricks-header-text-color", config.style.headerTitleColor);
      }
      if (config.style.boxBGColor) {
        root.style.setProperty("--formbricks-bg-color", config.style.boxBGColor);
      }
      if (config.style.textColor) {
        root.style.setProperty("--formbricks-text-color", config.style.textColor);
      }
      if (config.style.buttonHoverColor) {
        root.style.setProperty("--formbricks-button-hover-bg-color", config.style.buttonHoverColor);
      }
      if (config.style.borderRadius) {
        root.style.setProperty("--formbricks-border-radius", config.style.borderRadius);
      }
    }
  }
}

async function reset() {
  submission = {};
  currentElementIdx = 0;
  submissionId = null;

  const questionElements = Array.from(
    formContainer.getElementsByClassName("formbricks-element") as HTMLCollectionOf<HTMLFormElement>
  );
  questionElements.forEach((el) => {
    if (!el.classList.contains("formbricks-hidden")) {
      el.classList.add("formbricks-hidden");
    }
  });
  questionElements[0].classList.remove("formbricks-hidden");
}

async function submitElement(name?: string, value?: string) {
  if (!name || !value) {
    throw new Error('Missing "name" or "value"');
  }
  submission[name] = value;
  // loading indication start
  const currentQuestion = document.getElementById(`formbricks-question-${currentElementIdx}`);
  currentQuestion?.classList.add("formbricks-pulse");
  // submit to formbricks
  if (submissionId === null) {
    const response = await createSubmission(submission);
    submissionId = response.id;
  } else {
    await updateSubmission(submissionId, submission, !!("idealCustomer" in submission));
  }

  // loading indication end
  currentQuestion?.classList.remove("formbricks-pulse");
  // update dom
  currentQuestion?.classList.add("formbricks-hidden");
  currentElementIdx = currentElementIdx + 1;
  document.getElementById(`formbricks-question-${currentElementIdx}`)?.classList.remove("formbricks-hidden");
  // update progressbar
  const progressBarItems = Array.from(
    formContainer.getElementsByClassName("formbricks-progressbar-item") as HTMLCollectionOf<HTMLFormElement>
  );
  if (currentElementIdx <= progressBarItems.length - 1) {
    progressBarItems[currentElementIdx].classList.add("formbricks-progressbar-item-current");
    progressBarItems[currentElementIdx - 1].classList.remove("formbricks-progressbar-item-current");
  } else {
    // hide progressbar on thank you page
    document.getElementById("formbricks-progressbar-wrapper")?.classList.add("formbricks-hidden");
  }
}

async function createSubmission(submission: any) {
  if (!config.formId) {
    throw new Error("Missing formId");
  }
  const response = await fetch(`${config.formbricksUrl}/api/capture/forms/${config.formId}/submissions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      customer: config.customer,
      data: submission,
    }),
  });
  return response.json();
}

async function updateSubmission(submissionId: string, submission: any, finished: boolean = false) {
  if (!config.formId) {
    throw new Error("Missing formId");
  }
  const body: any = {
    data: submission,
  };
  if (finished) {
    body["finished"] = true;
  }
  const response = await fetch(
    `${config.formbricksUrl}/api/capture/forms/${config.formId}/submissions/${submissionId}`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }
  );
  return response.json();
}

const formbricks = { init, reset, config };
(window as any).formbricks = formbricks;

export default formbricks;
