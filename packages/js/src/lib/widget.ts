import { Survey } from "@formbricks/types/js";
import { h, render } from "preact";
import App from "../App";
import { Config } from "./config";
import { Logger } from "./logger";
import { getSettings } from "./settings";

const containerId = "formbricks-web-container";
const config = Config.getInstance();
const logger = Logger.getInstance();
let surveyRunning = false;

export const renderWidget = (survey: Survey) => {
  if (surveyRunning) {
    logger.debug("A survey is already running. Skipping.");
    return;
  }
  surveyRunning = true;
  render(h(App, { config: config.get(), survey, closeSurvey }), document.getElementById(containerId));
};

export const closeSurvey = async (): Promise<void> => {
  console.log("close survey called");
  // remove container element from DOM
  const container = document.getElementById(containerId);
  container.remove();
  addWidgetContainer();
  const settings = await getSettings();
  config.update({ settings });
  surveyRunning = false;
};

export const addWidgetContainer = (): void => {
  const containerElement = document.createElement("div");
  containerElement.id = containerId;
  document.body.appendChild(containerElement);
};
