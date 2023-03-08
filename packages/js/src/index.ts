import habitat from "preact-habitat";

import css from "./style.css";

import App from "./App";
import { createPerson, getLocalPerson, updatePersonUserId } from "./lib/person";
import type { Config } from "./types/types";
import { createSession, getLocalSession } from "./lib/session";

const _habitat = habitat(App);

let config: Config = { environmentId: null, apiHost: null };
let initFunction;
let currentlyExecuting = Promise.resolve();
let currentlyExecutingLock = false;

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

const setUserId = async (userId) => {
  if (!initFunction) {
    console.error("Formbricks: Error setting userId, init function not yet called");
    return;
  }
  const randomNumber = Math.floor(Math.random() * 100);
  await initFunction;
  await currentlyExecuting;
  if (currentlyExecutingLock) {
    console.error('multiple calls to "setUserId" are not allowed');
    return;
  }
  currentlyExecutingLock = true;
  currentlyExecuting = (async function () {
    if (userId === config.person.userId) {
      return;
    }
    if (!userId) {
      console.error("Formbricks: Error setting userId, userId is null or undefined");
      return;
    }
    const updatedPerson = await updatePersonUserId(config, userId);
    if (!updatedPerson) {
      console.error('Formbricks: Error updating "userId"');
      return;
    }
    config.person = updatedPerson;
    currentlyExecutingLock = false;
    return;
  })();
};

const reset = () => {
  delete config.person;
  delete config.session;
  localStorage.removeItem("formbricks__person");
  localStorage.removeItem("formbricks__session");
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

const formbricks = { init, setUserId, reset, config };

// (window as any).formbricks = formbricks;

export default formbricks;
