import habitat from "preact-habitat";

import css from "./style.css";

import App from "./App";
import {
  createPerson,
  getLocalPerson,
  updatePersonAttribute,
  updatePersonEmail,
  updatePersonUserId,
} from "./lib/person";
import type { Config } from "./types/types";
import { createSession, getLocalSession } from "./lib/session";

const _habitat = habitat(App);

let config: Config = { environmentId: null, apiHost: null };
let initFunction;
let currentlyExecuting = Promise.resolve();

const init = async (c: Config) => {
  if (!initFunction) {
    initFunction = populateConfig(c);
  }

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
};

const populateConfig = async (c: Config) => {
  config = c;
  // get or create person
  let newPerson;
  config.person = getLocalPerson();
  if (!config.person) {
    config.person = await createPerson(config);
    newPerson = true;
    if (!config.person) {
      return;
    }
  }
  // get or create session
  if (!newPerson) {
    // if new person, we need a new session and skip this step
    config.session = getLocalSession();
  }
  if (!config.session) {
    config.session = await createSession(config);
    if (!config.session) {
      return;
    }
  }
  console.log(config);
};

const setUserId = async (userId: string): Promise<void> => {
  if (!initFunction) {
    console.error("Formbricks: Error setting userId, init function not yet called");
    return;
  }
  await initFunction;
  await currentlyExecuting;
  currentlyExecuting = currentlyExecuting.then(async () => {
    if (!userId) {
      console.error("Formbricks: Error setting userId, userId is null or undefined");
      return;
    }
    if (userId === config.person.userId) {
      return;
    } else if (config.person.userId) {
      console.error("Formbricks: userId cannot be changed after it has been set. You need to reset first");
      return;
    }
    const updatedPerson = await updatePersonUserId(config, userId);
    if (!updatedPerson) {
      console.error('Formbricks: Error updating "userId"');
      return;
    }
    config.person = { ...config.person, ...updatedPerson };
    return;
  });
};

const setEmail = async (email: string): Promise<void> => {
  if (!initFunction) {
    console.error("Formbricks: Error setting email, init function not yet called");
    return;
  }
  await initFunction;
  await currentlyExecuting;
  currentlyExecuting = currentlyExecuting.then(async () => {
    if (!email) {
      console.error("Formbricks: Error setting userId, userId is null or undefined");
      return;
    }
    if (email === config.person.email) {
      return;
    }
    const updatedPerson = await updatePersonEmail(config, email);
    if (!updatedPerson) {
      console.error('Formbricks: Error updating "email"');
      return;
    }
    config.person = { ...config.person, ...updatedPerson };
    return;
  });
};

const setAttribute = async (key: string, value: string): Promise<void> => {
  if (!initFunction) {
    console.error("Formbricks: Error setting attribute, init function not yet called");
    return;
  }
  await initFunction;
  await currentlyExecuting;
  currentlyExecuting = currentlyExecuting.then(async () => {
    if (!key || !value) {
      console.error("Formbricks: Error setting attribute, please provide key and value");
      return;
    }
    if (value === config.person.attributes[key]) {
      return;
    }
    const updatedPerson = await updatePersonAttribute(config, key, value);
    if (!updatedPerson) {
      console.error("Formbricks: Error updating attribute");
      return;
    }
    config.person = { ...config.person, ...updatedPerson };
    return;
  });
};

const reset = () => {
  delete config.person;
  delete config.session;
  localStorage.removeItem("formbricks__person");
  localStorage.removeItem("formbricks__session");
  initFunction = populateConfig({ environmentId: config.environmentId, apiHost: config.apiHost });
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
    console.error("Formbricks: Error fetching forms");
    return;
  }
  const forms = formRes.json();
  return forms;
};

const formbricks = { init, setUserId, setEmail, setAttribute, reset, config };

// (window as any).formbricks = formbricks;

export default formbricks;
