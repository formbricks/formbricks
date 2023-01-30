import { computePosition, flip, shift } from "@floating-ui/dom";
import { createFocusTrap } from "focus-trap";

import { formHTML } from "./form-html";
import formCSS from "./form.css";

export interface FormbricksConfig {
  contact: {
    name: string;
    position: string;
    imgUrl: string;
  };
  divId?: string;
  style?: any;
  formId?: string;
  hqUrl?: string;
  customer?: Record<any, any>;
  disableErrorAlert: boolean;
}

let config: FormbricksConfig = {
  customer: {},
  disableErrorAlert: false,
  // Merge with existing config
  ...(window as any).formbricks?.config,
};

function init() {
  // add css to head
  const styleElement = document.createElement("style");
  styleElement.id = "formbricks__css";
  styleElement.innerHTML = formCSS;

  document.head.insertBefore(styleElement, document.head.firstChild);

  // add feedback button listener
  document.querySelectorAll("[data-formbricks-button]").forEach((el) => {
    el.addEventListener("click", open);
  });
  if (config.divId) {
    render();
  }
}
window.addEventListener("load", init);

const containerElement = document.createElement("div");
containerElement.id = "formbricks__container";

const trap = createFocusTrap(containerElement, {
  initialFocus: "#formbricks__form",
  allowOutsideClick: true,
});

function applyConfig() {
  if (config.contact) {
    const contactNameElements = document.getElementsByClassName("formbricks__contact-name");
    for (const elem of contactNameElements) {
      elem.innerHTML = config.contact.name;
    }
    const contactPositionElements = document.getElementsByClassName("formbricks__contact-position");
    for (const elem of contactPositionElements) {
      elem.innerHTML = config.contact.position;
    }
    const contactImageElements = document.getElementsByClassName("formbricks__contact-image");
    for (const elem of contactImageElements) {
      (<HTMLImageElement>elem).src = config.contact.imgUrl;
    }
  }
  // apply styles
  if (config.style) {
    const root = document.querySelector(":root") as HTMLElement;
    if (root !== null) {
      if (config.style.brandColor) {
        root.style.setProperty("--formbricks-brand-color", config.style.brandColor);
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

function onDisplay() {
  // check if styles are initialized
  const styleElement = document.getElementById("formbricks__css");
  if (styleElement === null) {
    init();
  }

  containerElement.innerHTML = formHTML;
  containerElement.style.display = "block";

  applyConfig();

  document.getElementById("formbricks__close")!.addEventListener("click", close);

  Array.from(containerElement.getElementsByClassName("formbricks__radio")).forEach((el) => {
    el.addEventListener("click", changeType);
  });

  document.getElementById("formbricks__type-switch")!.addEventListener("click", resetForm);

  document.getElementById("formbricks__form")!.addEventListener("submit", submit);

  trap.activate();
}

function open(e: Event, updatedConfig?: FormbricksConfig) {
  if (updatedConfig) {
    config = { ...config, ...updatedConfig };
  }
  if (config.divId) {
    console.error('open() is not supported when using "divId" in config.');
    return;
  }

  if (!containerElement.classList.contains("formbricks__modal")) {
    containerElement.classList.add("formbricks__modal");
  }

  const target = (e.target as HTMLElement) || document.body;
  computePosition(target, containerElement, {
    placement: "bottom",
    middleware: [flip(), shift({ crossAxis: true, padding: 8 })],
    strategy: "fixed",
  }).then(({ x, y }) => {
    Object.assign(containerElement.style, {
      left: `${x}px`,
      top: `${y}px`,
    });
  });

  document.body.appendChild(containerElement);
  onDisplay();

  document.getElementById("formbricks__close")!.style.display = "flex";

  // click outside of container closes widget
  e.preventDefault();
  e.stopPropagation();
  document.addEventListener("click", close);
  document.getElementById("formbricks__container")!.addEventListener("click", (event) => {
    event.stopPropagation();
  });
}

function render() {
  if (config.divId) {
    const div = document.getElementById(config.divId);
    if (div === null) {
      throw new Error(`No div with id ${config.divId} found`);
    }
    div.appendChild(containerElement);
    onDisplay();
  } else {
    console.error('render() only works when "divId" is present in config.');
  }
}

function close() {
  if (config.divId) {
    console.error('close() is not supported when using "divId" in config.');
    return;
  }
  trap.deactivate();

  containerElement.innerHTML = "";

  containerElement.remove();
  containerElement.removeAttribute("data-feedback-type");
  containerElement.removeAttribute("data-success");
}

function resetForm(e: Event) {
  document.getElementById("formbricks__type-switch")!.innerHTML = "";
  containerElement.removeAttribute("data-feedback-type");
}

function changeType(e: Event) {
  const feedbackType = (e.target as HTMLInputElement).value;

  containerElement.setAttribute("data-feedback-type", feedbackType);

  let placeholder = "";
  if (feedbackType === "bug") placeholder = "I tried to do this but it is not working because...";
  else if (feedbackType === "compliment") placeholder = "I want to say Thank you for...";
  else if (feedbackType === "idea") placeholder = "I would love to...";

  document.getElementById("formbricks__message")?.setAttribute("placeholder", placeholder);

  let contactTitle = "";
  if (feedbackType === "bug") contactTitle = "What is broken?";
  else if (feedbackType === "compliment") contactTitle = "Thanks for sharing this!";
  else if (feedbackType === "idea") contactTitle = "What’s your idea?";
  const contactMessageElem = document.getElementById("formbricks__contact-placeholder");
  if (contactMessageElem !== null) {
    contactMessageElem.innerText = contactTitle;
  }

  // set type switch
  const typeSwitchElem = document.getElementById("formbricks__type-switch");
  const typeElem = document.getElementById(`formbricks__radio-label--${feedbackType}`);
  if (typeSwitchElem !== null && typeElem !== null) {
    // replace children with feedback type elements (icon & text)
    typeSwitchElem.innerHTML = "";
    typeSwitchElem.replaceChildren(...typeElem.cloneNode(true).childNodes);
    // add chevron
    const chevronElem = document.createElement("div");
    chevronElem.innerHTML = `<svg class="formbricks__radio-icon" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6"><path stroke-linecap="round" stroke-linejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" /></svg>`;
    typeSwitchElem.appendChild(chevronElem);
  }
}

const stripLastBackslash = (url: string) => {
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

function submit(e: Event) {
  e.preventDefault();
  const target = e.target as HTMLFormElement;

  if (!config.formId) {
    console.error("Formbricks: No formId provided");
    if (!config.disableErrorAlert) alert("Unable to send feedback: No formId provided");
    return;
  }

  const submitElement = document.getElementById("formbricks__submit")!;
  submitElement.setAttribute("disabled", "");
  submitElement.innerHTML = "Sending…";

  const headers = new Headers();
  headers.append("Content-Type", "application/json");

  const body = {
    data: {
      feedbackType: (target.elements as any).feedbackType.value,
      message: (target.elements as any).message.value,
      pageUrl: window.location.href,
    },
    customer: config.customer,
    finished: true,
  };

  fetch(
    `${stripLastBackslash(config.hqUrl || "https://xm.formbricks.com")}/api/capture/forms/${
      config.formId
    }/submissions`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }
  )
    .then(() => {
      containerElement.setAttribute("data-success", "");
      const feedbackType = containerElement.getAttribute("data-feedback-type");
      let successTitle = "";
      let successSubtitle = "";
      if (feedbackType === "bug") {
        successTitle = "Feedback received.";
        successSubtitle = "We are doing our best to fix this asap. Thank you!";
      } else if (feedbackType === "compliment") {
        successTitle = "Thanks for sharing!";
        successSubtitle = "We’re working hard on this. Your warm words make it fun!";
      } else if (feedbackType === "idea") {
        successTitle = "Brainstorming in progress...";
        successSubtitle = "We’ll look into it and get back to you. Thank you!";
      }
      document.getElementById("formbricks__success-title")!.innerText = successTitle;
      document.getElementById("formbricks__success-subtitle")!.innerText = successSubtitle;
    })
    .catch((e) => {
      console.error("Formbricks:", e);
      if (!config.disableErrorAlert) alert(`Could not send feedback: ${e.message}`);
    });

  return false;
}

const formbricks = { init, open, changeType, close, render, submit, resetForm, config };
(window as any).formbricks = formbricks;

export default formbricks;
