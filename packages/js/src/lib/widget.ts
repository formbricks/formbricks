import { FormbricksAPI } from "@formbricks/api";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import SurveyState from "@formbricks/lib/surveyState";
import { renderSurveyModal } from "@formbricks/surveys";
import { TJSStateDisplay } from "@formbricks/types/js";
import { TResponseUpdate } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";

import { Config } from "./config";
import { ErrorHandler } from "./errors";
import { Logger } from "./logger";
import { filterPublicSurveys, sync } from "./sync";

const containerId = "formbricks-web-container";
const config = Config.getInstance();
const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();
let surveyRunning = false;
let isError = false;
let triggerError = () => {};

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

  const surveyState = new SurveyState(survey.id, null, null, config.get().userId);

  const responseQueue = new ResponseQueue(
    {
      apiHost: config.get().apiHost,
      environmentId: config.get().environmentId,
      retryAttempts: 2,
      onResponseSendingFailed: () => {
        isError = true;
      },
    },
    surveyState
  );

  const productOverwrites = survey.productOverwrites ?? {};
  const brandColor = productOverwrites.brandColor ?? product.brandColor;
  const highlightBorderColor = productOverwrites.highlightBorderColor ?? product.highlightBorderColor;
  const clickOutside = productOverwrites.clickOutsideClose ?? product.clickOutsideClose;
  const darkOverlay = productOverwrites.darkOverlay ?? product.darkOverlay;
  const placement = productOverwrites.placement ?? product.placement;
  const isBrandingEnabled = product.inAppSurveyBranding;

  setTimeout(() => {
    renderSurveyModal({
      survey: survey,
      brandColor,
      isBrandingEnabled: isBrandingEnabled,
      clickOutside,
      darkOverlay,
      highlightBorderColor,
      placement,
      isError,
      supportEmail: product.supportEmail,
      triggerErrorFunc: (setIsError: () => void) => {
        triggerError = setIsError;
      },
      onDisplay: async () => {
        const { userId } = config.get();
        // if config does not have a person, we store the displays in local storage
        if (!userId) {
          const localDisplay: TJSStateDisplay = {
            createdAt: new Date(),
            surveyId: survey.id,
            responded: false,
          };

          const existingDisplays = config.get().state.displays;
          const displays = existingDisplays ? [...existingDisplays, localDisplay] : [localDisplay];
          const previousConfig = config.get();
          let state = filterPublicSurveys({
            ...previousConfig.state,
            displays,
          });
          config.update({
            ...previousConfig,
            state,
          });
        }

        const api = new FormbricksAPI({
          apiHost: config.get().apiHost,
          environmentId: config.get().environmentId,
        });
        const res = await api.client.display.create({
          surveyId: survey.id,
          userId,
        });
        if (!res.ok) {
          throw new Error("Could not create display");
        }
        const { id } = res.data;

        surveyState.updateDisplayId(id);
        responseQueue.updateSurveyState(surveyState);
      },
      onResponse: (responseUpdate: TResponseUpdate) => {
        const { userId } = config.get();
        // if user is unidentified, update the display in local storage if not already updated
        if (!userId) {
          const displays = config.get().state.displays;
          const lastDisplay = displays && displays[displays.length - 1];
          if (!lastDisplay) {
            throw new Error("No lastDisplay found");
          }
          if (!lastDisplay.responded) {
            lastDisplay.responded = true;
            const previousConfig = config.get();
            let state = filterPublicSurveys({
              ...previousConfig.state,
              displays,
            });
            config.update({
              ...previousConfig,
              state,
            });
          }
        }

        if (userId) {
          surveyState.updateUserId(userId);
        }
        responseQueue.updateSurveyState(surveyState);
        responseQueue.add({
          data: responseUpdate.data,
          ttc: responseUpdate.ttc,
          finished: responseUpdate.finished,
        });
      },
      onClose: closeSurvey,
      onFileUpload: async (file: File, params) => {
        const api = new FormbricksAPI({
          apiHost: config.get().apiHost,
          environmentId: config.get().environmentId,
        });

        return await api.client.storage.uploadFile(file, params);
      },
    });
  }, survey.delay * 1000);
};

export const closeSurvey = async (): Promise<void> => {
  // remove container element from DOM
  document.getElementById(containerId)?.remove();
  addWidgetContainer();

  // if unidentified user, refilter the surveys
  if (!config.get().userId) {
    const state = config.get().state;
    const updatedState = filterPublicSurveys(state);
    config.update({
      ...config.get(),
      state: updatedState,
    });
    surveyRunning = false;
    return;
  }

  // for identified users we sync to get the latest surveys
  try {
    await sync({
      apiHost: config.get().apiHost,
      environmentId: config.get().environmentId,
      userId: config.get().userId,
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
