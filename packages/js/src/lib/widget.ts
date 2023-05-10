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

export const renderWidget = (survey: Survey) => {
  if (surveyRunning) {
    logger.debug("A survey is already running. Skipping.");
    return;
  }
  surveyRunning = true;

  render(
    h(App, { config: config.get(), survey, closeSurvey, errorHandler: errorHandler.handle }),
    document.getElementById(containerId)
  );
};

export const closeSurvey = async (): Promise<void> => {
  // remove container element from DOM
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
};

export const addWidgetContainer = (): void => {
  const containerElement = document.createElement("div");
  containerElement.id = containerId;
  document.body.appendChild(containerElement);
};
