import css from "./style.css";
import { h, render } from "preact";
import App from "./App";
import {
  attributeAlreadyExists,
  attributeAlreadySet,
  createPerson,
  getLocalPerson,
  updatePersonAttribute,
  updatePersonUserId,
} from "./lib/person";
import type { Config, Survey } from "./types/types";
import { checkSession, createSession, getLocalSession } from "./lib/session";
import { trackEvent, triggerSurveys } from "./lib/event";
import { addNewContainer } from "./lib/container";
import { checkPageUrl } from "./lib/noCodeEvents";

let config: Config = { environmentId: null, apiHost: null };
let initFunction; // Promise that resolves when init is complete
let resetRunning; // boolean indicating whether reset is currently running
let currentlyExecuting = Promise.resolve(); // Promise that resolves when the current survey operation is complete
let containerId; // id of the container element for the survey modal
const surveyQueue: Survey[] = []; // queue of surveys to be shown
const surveysShown: string[] = []; // ids of surveys that have been shown
let surveyRunning = false; // whether a survey is currently being shown

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
  if (containerId === undefined) {
    containerId = addNewContainer();
  }
};

const populateConfig = async (c: Config) => {
  config = c;
  // get or create person
  let newPerson;
  config.person = getLocalPerson();
  if (!config.person || config.person.environmentId !== config.environmentId) {
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
    const { session, noCodeEvents, surveys } = await createSession(config);
    config.session = session;
    config.noCodeEvents = noCodeEvents;
    config.surveys = surveys;
    if (!config.session) {
      console.error('Formbricks: Error creating "session"');
      return;
    }
    track("New Session");
  } else {
    // if we have a session, we also have surveys and noCodeEvents
    config.surveys = JSON.parse(localStorage.getItem("formbricks__surveys") || "[]");
    config.noCodeEvents = JSON.parse(localStorage.getItem("formbricks__noCodeEvents") || "[]");
  }
  // check page url for nocode events
  checkPageUrl(config, track);
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
    // check if attribute already exists with this value
    if (attributeAlreadySet(config, "userId", userId)) {
      return;
    }
    if (attributeAlreadyExists(config, "userId")) {
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
  setAttribute("email", email);
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
    // check if attribute already exists with this value
    if (attributeAlreadySet(config, key, value)) {
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

const reset = async () => {
  if (!resetRunning) {
    resetRunning = true;
    delete config.person;
    delete config.session;
    localStorage.removeItem("formbricks__person");
    localStorage.removeItem("formbricks__session");
    initFunction = populateConfig({ environmentId: config.environmentId, apiHost: config.apiHost });
    await initFunction;
    resetRunning = false;
  } else {
    console.log("Formbricks: Reset already running");
  }
};

const track = async (eventName: string, properties: any = {}) => {
  if (!initFunction) {
    console.error("Formbricks: Error setting attribute, init function not yet called");
    return;
  }
  await initFunction;
  await currentlyExecuting;
  currentlyExecuting = currentlyExecuting.then(async () => {
    if (!eventName) {
      console.error("Formbricks: Error tracking event, please provide an eventName");
      return;
    }
    const event = await trackEvent(config, eventName, properties);
    if (!event) {
      console.error("Formbricks: Error sending event");
      return;
    }
    const triggeredSurveys = triggerSurveys(config, eventName);
    if (triggeredSurveys && triggeredSurveys.length > 0) {
      for (const survey of triggeredSurveys) {
        // check if survey already in queue
        if (
          typeof surveyQueue.find((s) => s.id === survey.id) !== "undefined" ||
          surveysShown.indexOf(survey.id) > -1
        ) {
          continue;
        }
        surveyQueue.push(survey);
      }
      await workSurveyQueue();
    }
    return;
  });
};

const workSurveyQueue = async () => {
  if (surveyQueue.length === 0 || surveyRunning) {
    return;
  }
  surveyRunning = true;
  const survey = surveyQueue.shift();
  if (!survey) {
    return;
  }
  surveysShown.push(survey.id);
  renderSurvey(survey);
};

const renderSurvey = (survey) => {
  render(h(App, { config, survey, closeSurvey }), document.getElementById(containerId));
};

const closeSurvey = () => {
  // remove container element from DOM
  const container = document.getElementById(containerId);
  container.remove();
  containerId = addNewContainer();
  surveyRunning = false;
  // wait a second before starting next survey
  setTimeout(() => {
    workSurveyQueue();
  }, 1000);
};

const formbricks = { init, setUserId, setEmail, setAttribute, track, reset, config };

// check every minute if session is still valid
setInterval(() => {
  checkSession(config, initFunction);
}, 60000);

/* // add event listeners for no code events
window.addEventListener("load", () => {
  console.log(window.location.href);
}); */

export default formbricks;
