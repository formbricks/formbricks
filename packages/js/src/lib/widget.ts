import { FormbricksAPI } from "@formbricks/api";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import SurveyState from "@formbricks/lib/surveyState";
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
let setIsError = (_: boolean) => {};

export const renderWidget = async (survey: TSurvey) => {
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
        setIsError(true);
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

  const formbricksSurveys = await loadFormbricksSurveysExternally();

  setTimeout(() => {
    formbricksSurveys.renderSurveyModal({
      survey: survey,
      brandColor,
      isBrandingEnabled: isBrandingEnabled,
      clickOutside,
      darkOverlay,
      highlightBorderColor,
      placement,
      getSetIsError: (f: (value: boolean) => void) => {
        setIsError = f;
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
      onRetry: () => {
        setIsError(false);
        responseQueue.processQueue();
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

const loadFormbricksSurveysExternally = (): Promise<typeof window.formbricksSurveys> => {
  return new Promise((resolve, reject) => {
    if (window.formbricksSurveys) {
      resolve(window.formbricksSurveys);
    } else {
      const script = document.createElement("script");
      script.src =
        "https://fb-surveys-test.s3.eu-north-1.amazonaws.com/index.umd.js?response-content-disposition=inline&X-Amz-Security-Token=IQoJb3JpZ2luX2VjEJz%2F%2F%2F%2F%2F%2F%2F%2F%2F%2FwEaCmFwLXNvdXRoLTEiRjBEAiBQPjf%2BMh5v%2FrGa8%2BcMFSNrkkBBy6Celzif7hdGlH3PoQIgMNpznRyHad6VX8tmgcH5D9diU6dNk7JSvZp4nU2i8k0q5AIIVRAAGgw1NzY3NzU0Mzg2MjUiDL%2FBWHhF36XKpAd%2FqSrBArU4RUN4IlghGOx2dIBK3lGU1m40n9GH4LOkW8LczGgPF4jaDfGERrIM7HdIo8VlTxMR8NUmtkAXtmstU%2Bk%2FXX7Mm36RczYX0JeI9ckPbvw1Ua0Q9fSAMkQ2JhjTNAukBSXuYJxxsvQksxXlVtRfyrXQWaLcIJU6HIRELGCAGcq4R4AOcG6ed2ReBbLGaWBpdppMzxxT47G4k%2Bb77qZeISpvwVyf%2Fd7Aj47MiNUL%2FV3HLy3T7Qd%2FR%2FnR4xOWcOM7Yld%2FrqHF67Cgjliksen6YIoMVyP4JIW03MSa8P%2BRwVt0W7j2uh8M1Ys2TpZ7p0o%2FFD45uU%2BUUwxab7VVFE%2FV1zWF4sT6SGuvHdavhXwHQfIi1qfXms9UNWLU3BP40RbY44u%2FCGOIDVFwhfmpIXdVHjzyZbAZnd1W1RZE4Xz3bXM8rzC%2B57ytBjq0Ar30GOtjBxhDsRLXk1T%2Bp0%2BGXKRS22JPq%2BPfCCfSTi4fkQMxWaLBkGWNbBLlbwzLu0oA8gC2cZD3AZczV9qPIkA%2Bq4JK2yNoyXoA6WgB8OEw2Fddl4kESoJlbh6nWjQj30KRdOV6Uj22Tly%2FyMxxkBLEbeJELhXP%2FCNtKL3j1aD4l0UVOtsvJluxpi0EVfJuAN1Xq852eV4ToREqdO4oAcQx7Jk8ny9Rr9pX5qLB3cj5Um%2FDlXekYcYytaGuS0TrBKZemlo%2FSgTM2y6vwoZ9J478xbMJB1n8x8yKpjCiL89%2BEnNLDu4yv%2BAr6udFbSUwYAl7MkxYmBDk%2BcCu0syai9SDDMrwuZ%2B6TVdUq6ySx69rtP4LKU3QDDt7W7x8T%2FvXPVnP%2Fv8jLVbs34MW21UHh0725NST&X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=20240123T035840Z&X-Amz-SignedHeaders=host&X-Amz-Expires=43200&X-Amz-Credential=ASIAYMST6YEQRWPLI2GU%2F20240123%2Feu-north-1%2Fs3%2Faws4_request&X-Amz-Signature=47553220246b7a22c4511850d5bc2f71e5ef1ce74fedf2d47c859c845508922b"; // Replace with actual CDN URL
      script.async = true;
      script.onload = () => resolve(window.formbricksSurveys);
      script.onerror = reject;
      document.head.appendChild(script);
    }
  });
};
