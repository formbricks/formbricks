import { h, render } from "preact";
import type { TSurvey } from "../../../types/v1/surveys";
import App from "../App";
import { Config } from "./config";
import { ErrorHandler, match } from "./errors";
import { Logger } from "./logger";
import { sync } from "./sync";

const containerId = "formbricks-web-container";
const config = Config.getInstance();
const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();
let surveyRunning = false;

export const renderWidget = (survey: TSurvey) => {
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
};

export const closeSurvey = async (): Promise<void> => {
  // remove container element from DOM
  document.getElementById(containerId).remove();
  addWidgetContainer();

  const syncResult = await sync();

  match(
    syncResult,
    (value) => {
      config.update({ state: value });
      surveyRunning = false;
    },
    (error) => {
      errorHandler.handle(error);
    }
  );
};

export const addWidgetContainer = (): void => {
  const containerElement = document.createElement("div");
  containerElement.id = containerId;
  document.body.appendChild(containerElement);
};
