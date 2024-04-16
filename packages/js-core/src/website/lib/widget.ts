import { FormbricksAPI } from "@formbricks/api";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import SurveyState from "@formbricks/lib/surveyState";
import { TJSWebsiteStateDisplay } from "@formbricks/types/js";
import { TResponseUpdate } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";

import { Logger } from "../../shared/logger";
import { getDefaultLanguageCode } from "../../shared/utils";
import { WebsiteConfig } from "./config";
import { filterPublicSurveys } from "./sync";

const containerId = "formbricks-web-container";

const websiteConfig = WebsiteConfig.getInstance();
const logger = Logger.getInstance();

let isSurveyRunning = false;
let setIsError = (_: boolean) => {};
let setIsResponseSendingFinished = (_: boolean) => {};

export const setIsSurveyRunning = (value: boolean) => {
  isSurveyRunning = value;
};

const shouldDisplayBasedOnPercentage = (displayPercentage: number) => {
  const randomNum = Math.floor(Math.random() * 100) + 1;
  return randomNum <= displayPercentage;
};

export const triggerSurvey = async (survey: TSurvey, action?: string): Promise<void> => {
  // Check if the survey should be displayed based on displayPercentage
  if (survey.displayPercentage) {
    const shouldDisplaySurvey = shouldDisplayBasedOnPercentage(survey.displayPercentage);
    if (!shouldDisplaySurvey) {
      logger.debug("Survey display skipped based on displayPercentage.");
      return; // skip displaying the survey
    }
  }
  await renderWidget(survey, action);
};

const renderWidget = async (survey: TSurvey, action?: string) => {
  if (isSurveyRunning) {
    logger.debug("A survey is already running. Skipping.");
    return;
  }
  setIsSurveyRunning(true);

  if (survey.delay) {
    logger.debug(`Delaying survey by ${survey.delay} seconds.`);
  }

  const product = websiteConfig.get().state.product;

  // const isMultiLanguageSurvey = survey.languages.length > 1;
  let languageCode = "default";

  // if (isMultiLanguageSurvey) {
  //   const displayLanguage = getLanguageCode(survey, attributes);
  //   //if survey is not available in selected language, survey wont be shown
  //   if (!displayLanguage) {
  //     logger.debug("Survey not available in specified language.");
  //     setIsSurveyRunning(true);
  //     return;
  //   }
  //   languageCode = displayLanguage;
  // }

  const surveyState = new SurveyState(survey.id, null, null);

  const responseQueue = new ResponseQueue(
    {
      apiHost: websiteConfig.get().apiHost,
      environmentId: websiteConfig.get().environmentId,
      retryAttempts: 2,
      onResponseSendingFailed: () => {
        setIsError(true);
      },
      onResponseSendingFinished: () => {
        setIsResponseSendingFinished(true);
      },
    },
    surveyState
  );
  const productOverwrites = survey.productOverwrites ?? {};
  const clickOutside = productOverwrites.clickOutsideClose ?? product.clickOutsideClose;
  const darkOverlay = productOverwrites.darkOverlay ?? product.darkOverlay;
  const placement = productOverwrites.placement ?? product.placement;
  const isBrandingEnabled = product.inAppSurveyBranding;
  const formbricksSurveys = await loadFormbricksSurveysExternally();

  const getStyling = () => {
    // allow style overwrite is disabled from the product
    if (!product.styling.allowStyleOverwrite) {
      return product.styling;
    }

    // allow style overwrite is enabled from the product
    if (product.styling.allowStyleOverwrite) {
      // survey style overwrite is disabled
      if (!survey.styling?.overwriteThemeStyling) {
        return product.styling;
      }

      // survey style overwrite is enabled
      return survey.styling;
    }

    return product.styling;
  };

  setTimeout(() => {
    formbricksSurveys.renderSurveyModal({
      survey: survey,
      isBrandingEnabled: isBrandingEnabled,
      clickOutside,
      darkOverlay,
      languageCode,
      placement,
      styling: getStyling(),
      getSetIsError: (f: (value: boolean) => void) => {
        setIsError = f;
      },
      getSetIsResponseSendingFinished: (f: (value: boolean) => void) => {
        setIsResponseSendingFinished = f;
      },
      onDisplay: async () => {
        const localDisplay: TJSWebsiteStateDisplay = {
          createdAt: new Date(),
          surveyId: survey.id,
          responded: false,
        };

        const existingDisplays = websiteConfig.get().state.displays;
        const displays = existingDisplays ? [...existingDisplays, localDisplay] : [localDisplay];
        const previousConfig = websiteConfig.get();

        let state = filterPublicSurveys({
          ...previousConfig.state,
          displays,
        });

        websiteConfig.update({
          ...previousConfig,
          state,
        });

        responseQueue.updateSurveyState(surveyState);
      },
      onResponse: (responseUpdate: TResponseUpdate) => {
        const displays = websiteConfig.get().state.displays;
        const lastDisplay = displays && displays[displays.length - 1];
        if (!lastDisplay) {
          throw new Error("No lastDisplay found");
        }
        if (!lastDisplay.responded) {
          lastDisplay.responded = true;
          const previousConfig = websiteConfig.get();
          let state = filterPublicSurveys({
            ...previousConfig.state,
            displays,
          });
          websiteConfig.update({
            ...previousConfig,
            state,
          });
        }

        responseQueue.updateSurveyState(surveyState);

        responseQueue.add({
          data: responseUpdate.data,
          ttc: responseUpdate.ttc,
          finished: responseUpdate.finished,
          language: languageCode === "default" ? getDefaultLanguageCode(survey) : languageCode,
          meta: {
            url: window.location.href,
            action,
          },
        });
      },
      onClose: closeSurvey,
      onFileUpload: async (file: File, params) => {
        const api = new FormbricksAPI({
          apiHost: websiteConfig.get().apiHost,
          environmentId: websiteConfig.get().environmentId,
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
  removeWidgetContainer();
  addWidgetContainer();

  const state = websiteConfig.get().state;
  const updatedState = filterPublicSurveys(state);
  websiteConfig.update({
    ...websiteConfig.get(),
    state: updatedState,
  });
  setIsSurveyRunning(false);
  return;
};

export const addWidgetContainer = (): void => {
  const containerElement = document.createElement("div");
  containerElement.id = containerId;
  document.body.appendChild(containerElement);
};

export const removeWidgetContainer = (): void => {
  document.getElementById(containerId)?.remove();
};

const loadFormbricksSurveysExternally = (): Promise<typeof window.formbricksSurveys> => {
  return new Promise((resolve, reject) => {
    if (window.formbricksSurveys) {
      resolve(window.formbricksSurveys);
    } else {
      const script = document.createElement("script");
      script.src = `${websiteConfig.get().apiHost}/api/packages/surveys`;
      script.async = true;
      script.onload = () => resolve(window.formbricksSurveys);
      script.onerror = (error) => {
        console.error("Failed to load Formbricks Surveys library:", error);
        reject(error);
      };
      document.head.appendChild(script);
    }
  });
};
