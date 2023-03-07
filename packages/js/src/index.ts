import habitat from "preact-habitat";

import css from "./style.css";

import App from "./App";
import { createPerson, getLocalPerson } from "./lib/person";
import type { Config } from "./types/types";
import { createSession, getLocalSession } from "./lib/session";

const _habitat = habitat(App);

let config: Config = { environmentId: null, apiHost: null };

const init = async (c: Config) => {
  config = c;
  // add styles
  if (document.getElementById("formbricks__css") === null) {
    const styleElement = document.createElement("style");
    styleElement.id = "formbricks__css";
    styleElement.innerHTML = css;
    document.head.appendChild(styleElement);
  }
  // add container element
  if (document.getElementById("formbricks__container") === null) {
    const containerElement = document.createElement("div");
    containerElement.id = "formbricks__container";
    document.body.appendChild(containerElement);
  }
  // get or create person
  config.person = getLocalPerson();
  if (!config.person) {
    config.person = await createPerson(config);
    if (!config.person) {
      return;
    }
  }
  // get or create session
  config.session = getLocalSession();
  if (!config.session) {
    config.session = await createSession(config);
    if (!config.session) {
      return;
    }
  }
  config.initialized = true;
  // register widget session
  console.log("formbricks initialized");
  console.log(config);
};

/* const identify = (userEmail, userProperties) => {
  const customer = {
    email: userEmail,
    data: userProperties,
  };
  globalConfig.person = customer;
  // save to local storage
  localStorage.setItem("formbricks__customer", JSON.stringify(customer));
}; */

const reset = () => {
  delete config.person;
  localStorage.removeItem("formbricks__customer");
};

const renderForm = (formId, schema) => {
  _habitat.render({
    selector: "#formbricks__container",
    clean: true,
    defaultProps: { config, schema, formId },
  });
};

const getForms = async () => {
  const formRes = await fetch(`${config.apiHost}/api/public/${config.environmentId}/forms`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!formRes.ok) {
    console.error("Error fetching forms");
    return;
  }
  const forms = formRes.json();
  return forms;
};

const formbricks = { init, reset, config };

// (window as any).formbricks = formbricks;

export default formbricks;
