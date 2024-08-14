import { FormbricksAPI } from "@formbricks/api";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import { SurveyState } from "@formbricks/lib/surveyState";
import { getStyling } from "@formbricks/lib/utils/styling";
import { TJsTrackProperties } from "@formbricks/types/js";
import { TResponseHiddenFieldValue, TResponseUpdate } from "@formbricks/types/responses";
import { TUploadFileConfig } from "@formbricks/types/storage";
import { TSurvey } from "@formbricks/types/surveys/types";
import { ErrorHandler } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import {
  getDefaultLanguageCode,
  getLanguageCode,
  handleHiddenFields,
  shouldDisplayBasedOnPercentage,
} from "../../shared/utils";
import { AppConfig } from "./config";
import { putFormbricksInErrorState } from "./initialize";
import { sync } from "./sync";

const containerId = "formbricks-app-container";

const appConfig = AppConfig.getInstance();
const logger = Logger.getInstance();
const errorHandler = ErrorHandler.getInstance();
let isSurveyRunning = false;
let setIsError = (_: boolean) => {};
let setIsResponseSendingFinished = (_: boolean) => {};

export const setIsSurveyRunning = (value: boolean) => {
  isSurveyRunning = value;
};

export const triggerSurvey = async (
  survey: TSurvey,
  action?: string,
  properties?: TJsTrackProperties
): Promise<void> => {
  // Check if the survey should be displayed based on displayPercentage
  if (survey.displayPercentage) {
    const shouldDisplaySurvey = shouldDisplayBasedOnPercentage(survey.displayPercentage);
    if (!shouldDisplaySurvey) {
      logger.debug(`Survey display of "${survey.name}" skipped based on displayPercentage.`);
      return; // skip displaying the survey
    }
  }

  const hiddenFieldsObject: TResponseHiddenFieldValue = handleHiddenFields(
    survey.hiddenFields,
    properties?.hiddenFields
  );

  await renderWidget(survey, action, hiddenFieldsObject);
};

const renderWidget = async (
  survey: TSurvey,
  action?: string,
  hiddenFields: TResponseHiddenFieldValue = {}
) => {
  if (isSurveyRunning) {
    logger.debug("A survey is already running. Skipping.");
    return;
  }
  setIsSurveyRunning(true);

  if (survey.delay) {
    logger.debug(`Delaying survey "${survey.name}" by ${survey.delay} seconds.`);
  }

  const product = appConfig.get().state.product;
  const attributes = appConfig.get().state.attributes;

  const isMultiLanguageSurvey = survey.languages.length > 1;
  let languageCode = "default";

  if (isMultiLanguageSurvey) {
    const displayLanguage = getLanguageCode(survey, attributes);
    //if survey is not available in selected language, survey wont be shown
    if (!displayLanguage) {
      logger.debug(`Survey "${survey.name}" is not available in specified language.`);
      setIsSurveyRunning(true);
      return;
    }
    languageCode = displayLanguage;
  }

  const surveyState = new SurveyState(survey.id, null, null, appConfig.get().userId);

  const responseQueue = new ResponseQueue(
    {
      apiHost: appConfig.get().apiHost,
      environmentId: appConfig.get().environmentId,
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

  setTimeout(() => {
    formbricksSurveys.renderSurveyModal({
      survey,
      isBrandingEnabled,
      clickOutside,
      darkOverlay,
      languageCode,
      placement,
      styling: getStyling(product, survey),
      getSetIsError: (f: (value: boolean) => void) => {
        setIsError = f;
      },
      getSetIsResponseSendingFinished: (f: (value: boolean) => void) => {
        setIsResponseSendingFinished = f;
      },
      onDisplay: async () => {
        const { userId } = appConfig.get();

        const api = new FormbricksAPI({
          apiHost: appConfig.get().apiHost,
          environmentId: appConfig.get().environmentId,
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
        const { userId } = appConfig.get();
        surveyState.updateUserId(userId);

        responseQueue.updateSurveyState(surveyState);
        responseQueue.add({
          data: responseUpdate.data,
          ttc: responseUpdate.ttc,
          finished: responseUpdate.finished,
          language:
            responseUpdate.language === "default" ? getDefaultLanguageCode(survey) : responseUpdate.language,
          meta: {
            url: window.location.href,
            action,
          },
          hiddenFields,
        });
      },
      onClose: closeSurvey,
      onFileUpload: async (
        file: { type: string; name: string; base64: string },
        params: TUploadFileConfig
      ) => {
        const api = new FormbricksAPI({
          apiHost: appConfig.get().apiHost,
          environmentId: appConfig.get().environmentId,
        });

        return await api.client.storage.uploadFile(
          {
            type: file.type,
            name: file.name,
            base64: file.base64,
          },
          params
        );
      },
      onRetry: () => {
        setIsError(false);
        responseQueue.processQueue();
      },
      hiddenFieldsRecord: hiddenFields,
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
        apiHost: appConfig.get().apiHost,
        environmentId: appConfig.get().environmentId,
        userId: appConfig.get().userId,
        attributes: appConfig.get().state.attributes,
      },
      true,
      appConfig
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
      script.src = `${appConfig.get().apiHost}/api/packages/surveys`;
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
