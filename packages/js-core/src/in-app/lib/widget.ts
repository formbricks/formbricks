import { FormbricksAPI } from "@formbricks/api";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import SurveyState from "@formbricks/lib/surveyState";
import { TResponseUpdate } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys";

import { ErrorHandler } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { getDefaultLanguageCode, getLanguageCode } from "../../shared/utils";
import { InAppConfig } from "./config";
import { putFormbricksInErrorState } from "./initialize";
import { sync } from "./sync";

const containerId = "formbricks-web-container";

const inAppConfig = InAppConfig.getInstance();
const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();
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

  const product = inAppConfig.get().state.product;
  const attributes = inAppConfig.get().state.attributes;

  const isMultiLanguageSurvey = survey.languages.length > 1;
  let languageCode = "default";

  if (isMultiLanguageSurvey) {
    const displayLanguage = getLanguageCode(survey, attributes);
    //if survey is not available in selected language, survey wont be shown
    if (!displayLanguage) {
      logger.debug("Survey not available in specified language.");
      setIsSurveyRunning(true);
      return;
    }
    languageCode = displayLanguage;
  }

  const surveyState = new SurveyState(survey.id, null, null, inAppConfig.get().userId);

  const responseQueue = new ResponseQueue(
    {
      apiHost: inAppConfig.get().apiHost,
      environmentId: inAppConfig.get().environmentId,
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
        const { userId } = inAppConfig.get();

        const api = new FormbricksAPI({
          apiHost: inAppConfig.get().apiHost,
          environmentId: inAppConfig.get().environmentId,
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
        const { userId } = inAppConfig.get();
        surveyState.updateUserId(userId);

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
          apiHost: inAppConfig.get().apiHost,
          environmentId: inAppConfig.get().environmentId,
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

  // for identified users we sync to get the latest surveys
  try {
    await sync(
      {
        apiHost: inAppConfig.get().apiHost,
        environmentId: inAppConfig.get().environmentId,
        userId: inAppConfig.get().userId,
      },
      true
    );
    setIsSurveyRunning(false);
  } catch (e: any) {
    errorHandler.handle(e);
    putFormbricksInErrorState();
  }
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
      script.src = `${inAppConfig.get().apiHost}/api/packages/surveys`;
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
