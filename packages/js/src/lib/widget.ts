import { ResponseQueue } from "@formbricks/lib/responseQueue";
import SurveyState from "@formbricks/lib/surveyState";
import { renderSurveyModal } from "@formbricks/surveys";
import { TSurveyWithTriggers } from "@formbricks/types/js";
import { TResponseUpdate } from "@formbricks/types/responses";
import { Config } from "./config";
import { ErrorHandler } from "./errors";
import { Logger } from "./logger";
import { sync } from "./sync";
import { FormbricksAPI } from "@formbricks/api";

const containerId = "formbricks-web-container";
const config = Config.getInstance();
const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();
const language = "de";
let surveyRunning = false;

export const renderWidget = (survey: TSurveyWithTriggers) => {
  if (surveyRunning) {
    logger.debug("A survey is already running. Skipping.");
    return;
  }
  surveyRunning = true;

  if (survey.delay) {
    logger.debug(`Delaying survey by ${survey.delay} seconds.`);
  }

  const product = config.get().state.product;

  const surveyState = new SurveyState(survey.id, null, null, config.get().state.person?.id);

  const responseQueue = new ResponseQueue(
    {
      apiHost: config.get().apiHost,
      retryAttempts: 2,
      onResponseSendingFailed: (response) => {
        alert(`Failed to send response: ${JSON.stringify(response, null, 2)}`);
      },
    },
    surveyState
  );

  const productOverwrites = survey.productOverwrites ?? {};
  const brandColor = productOverwrites.brandColor ?? product.brandColor;
  const highlightBorderColor = productOverwrites.highlightBorderColor ?? product.highlightBorderColor;
  const clickOutside = productOverwrites.clickOutside ?? product.clickOutsideClose;
  const darkOverlay = productOverwrites.darkOverlay ?? product.darkOverlay;
  const placement = productOverwrites.placement ?? product.placement;

  setTimeout(() => {
    renderSurveyModal({
      survey: survey,
      brandColor,
      formbricksSignature: true,
      clickOutside,
      darkOverlay,
      language,
      highlightBorderColor,
      placement,
      onDisplay: async () => {
        const api = new FormbricksAPI({
          apiHost: config.get().apiHost,
          environmentId: config.get().environmentId,
        });
        const res = await api.client.display.create({
          surveyId: survey.id,
          personId: config.get().state.person.id,
        });
        if (!res.ok) {
          throw new Error("Could not create display");
        }
        const { id } = res.data;

        surveyState.updateDisplayId(id);
        responseQueue.updateSurveyState(surveyState);
      },
      onResponse: (responseUpdate: TResponseUpdate) => {
        surveyState.updatePersonId(config.get().state.person.id);
        responseQueue.updateSurveyState(surveyState);
        responseQueue.add({
          data: responseUpdate.data,
          finished: responseUpdate.finished,
        });
      },
      onClose: closeSurvey,
    });
  }, survey.delay * 1000);
};

export const closeSurvey = async (): Promise<void> => {
  // remove container element from DOM
  document.getElementById(containerId)?.remove();
  addWidgetContainer();

  try {
    await sync({
      apiHost: config.get().apiHost,
      environmentId: config.get().environmentId,
      personId: config.get().state.person?.id,
      sessionId: config.get().state.session?.id,
    });
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
