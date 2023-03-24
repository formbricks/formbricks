import type { Config, InitConfig, Survey } from "@formbricks/types/js";
import { h, render } from "preact";
import App from "./App";
import { addNewContainer } from "./lib/container";
import { trackEvent, triggerSurveys } from "./lib/event";
import { checkPageUrl } from "./lib/noCodeEvents";
import {
  attributeAlreadyExists,
  attributeAlreadySet,
  createPerson,
  updatePersonAttribute,
  updatePersonUserId,
} from "./lib/person";
import { Logger } from "./lib/logger";
import { createSession, extendOrCreateSession, isExpired } from "./lib/session";
import { persistConfig, removeConfig, retrieveConfig } from "./lib/storage";
import css from "./style.css";

let config: Config = { environmentId: null, apiHost: null };
let initFunction; // Promise that resolves when init is complete
let resetRunning; // boolean indicating whether reset is currently running
let currentlyExecuting = Promise.resolve(); // Promise that resolves when the current survey operation is complete
let containerId; // id of the container element for the survey modal
const surveyQueue: Survey[] = []; // queue of surveys to be shown
const surveysShown: string[] = []; // ids of surveys that have been shown
let surveyRunning = false; // whether a survey is currently being shown

const logger = Logger.getInstance();

const init = async (c: InitConfig) => {
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

const populateConfig = async (c: InitConfig) => {
  if (c.logLevel) {
    logger.configure({ logLevel: c.logLevel });
  }

  const existingConfig = retrieveConfig();
  // check if config already exists and was created with the same environmentId
  if (
    existingConfig &&
    existingConfig.environmentId === c.environmentId &&
    existingConfig.apiHost === c.apiHost
  ) {
    config = { ...existingConfig };
  } else {
    config = { ...config, environmentId: c.environmentId, apiHost: c.apiHost };
  }
  // get or create person
  let newPerson = false;
  if (!config.person) {
    logger.debug("No person found in config, creating new person");
    config.person = await createPerson(config);
    newPerson = true;
    if (!config.person) {
      logger.error('Formbricks: Error creating "person"');
      return;
    }
  }
  if (newPerson || !config.session || isExpired(config.session) || !config.settings) {
    logger.debug("Creating new session");
    const { session, settings } = await createSession(config);
    config.session = session;
    config.settings = settings;
    if (!config.session || !config.settings) {
      logger.error('Formbricks: Error creating "session"');
      return;
    }
    logger.debug("New session created. Sending new session event");
    track("New Session");
  }
  // save config to local storage
  persistConfig(config);
  // check page url for nocode events
  checkPageUrl(config, track);
};

const setUserId = async (userId: string): Promise<void> => {
  if (!initFunction) {
    logger.error("Formbricks: Error setting userId, init function not yet called");
    return;
  }
  await initFunction;
  await currentlyExecuting;
  currentlyExecuting = currentlyExecuting.then(async () => {
    if (!userId) {
      logger.error("Formbricks: Error setting userId, userId is null or undefined");
      return;
    }
    // check if attribute already exists with this value
    if (attributeAlreadySet(config, "userId", userId)) {
      return;
    }
    if (attributeAlreadyExists(config, "userId")) {
      logger.error("Formbricks: userId cannot be changed after it has been set. You need to reset first");
      return;
    }
    const updatedPerson = await updatePersonUserId(config, userId);
    if (!updatedPerson) {
      logger.error('Formbricks: Error updating "userId"');
      return;
    }
    config.person = { ...config.person, ...updatedPerson };
    persistConfig(config);
    return;
  });
};

const setEmail = async (email: string): Promise<void> => {
  setAttribute("email", email);
};

const setAttribute = async (key: string, value: string): Promise<void> => {
  if (!initFunction) {
    logger.error("Formbricks: Error setting attribute, init function not yet called");
    return;
  }
  await initFunction;
  await currentlyExecuting;
  currentlyExecuting = currentlyExecuting.then(async () => {
    if (!key || !value) {
      logger.error("Formbricks: Error setting attribute, please provide key and value");
      return;
    }
    // check if attribute already exists with this value
    if (attributeAlreadySet(config, key, value)) {
      return;
    }

    const updatedPerson = await updatePersonAttribute(config, key, value);
    if (!updatedPerson) {
      logger.error("Formbricks: Error updating attribute");
      return;
    }
    config.person = { ...config.person, ...updatedPerson };
    persistConfig(config);
    return;
  });
};

const reset = async () => {
  if (!resetRunning) {
    resetRunning = true;
    const initConfig: InitConfig = {
      environmentId: config.environmentId,
      apiHost: config.apiHost,
    };
    removeConfig();
    initFunction = populateConfig(initConfig);
    await initFunction;
    resetRunning = false;
  } else {
    logger.debug("Reset already running");
  }
};

const track = async (eventName: string, properties: any = {}) => {
  if (!initFunction) {
    logger.error("Error setting attribute, init function not yet called");
    return;
  }
  await initFunction;
  await currentlyExecuting;
  currentlyExecuting = currentlyExecuting.then(async () => {
    if (!eventName) {
      logger.error("Error tracking event, please provide an eventName");
      return;
    }
    const event = await trackEvent(config, eventName, properties);
    if (!event) {
      logger.error("Formbricks: Error sending event");
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
  render(
    h(App, { config, survey, closeSurvey, brandColor: config.settings?.brandColor }),
    document.getElementById(containerId)
  );
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
if (typeof window !== "undefined") {
  window?.setInterval(async () => {
    config = await extendOrCreateSession(config, initFunction);
    persistConfig(config);
  }, 60000);
}

export default formbricks;
