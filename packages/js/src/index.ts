import habitat from "preact-habitat";

import css from "./style.css";

import App from "./App";
import { getNewPerson } from "./lib/person";
import type { Config } from "./types/types";

const _habitat = habitat(App);

let globalConfig: Config = { environmentId: null, apiHost: null };

const init = async (config: Config) => {
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
  // set config
  globalConfig = config;
  // check local storage for user
  const person = localStorage.getItem("formbricks__person");
  if (person) {
    config.person = JSON.parse(person);
  } else {
    // create new person
    const person = await getNewPerson(config);
    console.log(JSON.stringify(person));
    config.person = { id: person.id };
    localStorage.setItem("formbricks__person", JSON.stringify(config.person));
  }
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
  delete globalConfig.person;
  localStorage.removeItem("formbricks__customer");
};

const renderForm = (formId, schema) => {
  _habitat.render({
    selector: "#formbricks__container",
    clean: true,
    defaultProps: { globalConfig, schema, formId },
  });
};

const getForms = async () => {
  const formRes = await fetch(`${globalConfig.apiHost}/api/public/${globalConfig.environmentId}/forms`, {
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

const formbricks = { init, reset, globalConfig };

// (window as any).formbricks = formbricks;

export default formbricks;
