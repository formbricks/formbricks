import { h, render } from "preact";
import type { TSurvey } from "../../../types/v1/surveys";
import App from "../App";
import { Config } from "./config";
import { ErrorHandler, match } from "./errors";
import { Logger } from "./logger";
import { sync } from "./sync";
import { renderSurveyModal } from "@formbricks/surveys";

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

  const product = config.get().state.product;

  console.log("product", product);

  setTimeout(() => {
    renderSurveyModal({
      survey: survey,
      brandColor: product.brandColor,
      formbricksSignature: product.formbricksSignature,
      clickOutside: product.clickOutsideClose,
      darkOverlay: product.darkOverlay,
      highlightBorderColor: product.highlightBorderColor,
      placement: product.placement,
      onDisplay: () => {
        console.log("Survey displayed");
      },
      onResponse: (responseUpdate) => {
        console.log("Survey response", responseUpdate);
      },
      onClose: () => {
        console.log("Survey closed");
      },
    });
    /* render(
      h(App, { config: config.get(), survey, closeSurvey, errorHandler: errorHandler.handle }),
      document.getElementById(containerId)
    ); */
  }, survey.delay * 1000);
};

export const closeSurvey = async (): Promise<void> => {
  // remove container element from DOM
  document.getElementById(containerId).remove();
  addWidgetContainer();

  try {
    await sync();
    surveyRunning = false;
  } catch (e) {
    errorHandler.handle(e);
  }
};

export const addWidgetContainer = (): void => {
  const containerElement = document.createElement("div");
  containerElement.id = containerId;
  document.body.appendChild(containerElement);
};
