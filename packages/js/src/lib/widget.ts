import type { Survey } from "../../../types/js";
import { h, render } from "preact";
import App from "../App";
import { Config } from "./config";
import { ErrorHandler, match } from "./errors";
import { Logger } from "./logger";
import { getSettings } from "./settings";

const containerId = "formbricks-web-container";
const config = Config.getInstance();
const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();
let surveyRunning = false;
let exitIntentListener: ((e: MouseEvent) => void) | null = null;
let scrollDepthListener: ((e: Event) => void) | null = null;

export const renderWidget = (survey: Survey) => {
  logger.debug("widget rendered")
  if (surveyRunning) {
    logger.debug("A survey is already running. Skipping.");
    return;
  }
  surveyRunning = true;

  if (survey.delay) {
    logger.debug(`Delaying survey by ${survey.delay} seconds.`);
  }

  setTimeout(() => {
    render(
      h(App, { config: config.get(), survey, closeSurvey, errorHandler: errorHandler.handle }),
      document.getElementById(containerId)
    );
  }, survey.delay * 1000);

  addExitIntentListener(survey);
  addScrollDepthListener(survey);
};

export const closeSurvey = async (): Promise<void> => {
  document.getElementById(containerId).remove();
  addWidgetContainer();

  const settings = await getSettings();

  match(
    settings,
    (value) => {
      config.update({ settings: value });
      surveyRunning = false;
    },
    (error) => {
      errorHandler.handle(error);
    }
  );

    removeExitIntentListener();
    removeScrollDepthListener();
};


const addExitIntentListener = (survey: Survey) => {
  logger.debug("AddExitIntentListener being created")
  exitIntentListener = function(e) {
    if (e.clientY <= 0) {
      renderWidget(survey);
      removeExitIntentListener();
    }
  };
  document.addEventListener('mousemove', exitIntentListener);
};


const addScrollDepthListener = (survey: Survey) => {
  logger.debug("addScrollDepthListener being created")

  scrollDepthListener = function() {
    let scrollDepth = (window.pageYOffset / document.body.scrollHeight) * 100;
    if (scrollDepth > 50) {
      renderWidget(survey);
      removeScrollDepthListener();
    }
  };
  window.addEventListener('scroll', scrollDepthListener);
};


const removeExitIntentListener = () => {
  if (exitIntentListener) {
    document.removeEventListener('mousemove', exitIntentListener);
    exitIntentListener = null;
  }
};


const removeScrollDepthListener = () => {
  if (scrollDepthListener) {
    window.removeEventListener('scroll', scrollDepthListener);
    scrollDepthListener = null;
  }
};

export const addWidgetContainer = (): void => {
  const containerElement = document.createElement("div");
  containerElement.id = containerId;
  document.body.appendChild(containerElement);
};
