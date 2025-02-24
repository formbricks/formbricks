/* eslint-disable no-console -- Required for error logging */
/* eslint-disable @typescript-eslint/no-empty-function -- There are some empty functions here that we need */
import { FormbricksAPI } from "@formbricks/api";
import { ResponseQueue } from "@formbricks/lib/responseQueue";
import { SurveyState } from "@formbricks/lib/surveyState";
import { getStyling } from "@formbricks/lib/utils/styling";
import {
  type TJsEnvironmentStateSurvey,
  type TJsFileUploadParams,
  type TJsPersonState,
  type TJsTrackProperties,
} from "@formbricks/types/js";
import { type TResponseHiddenFieldValue, type TResponseUpdate } from "@formbricks/types/responses";
import { type TUploadFileConfig } from "@formbricks/types/storage";
import { Config } from "./config";
import { CONTAINER_ID } from "./constants";
import { Logger } from "./logger";
import { TimeoutStack } from "./timeout-stack";
import {
  filterSurveys,
  getDefaultLanguageCode,
  getLanguageCode,
  handleHiddenFields,
  shouldDisplayBasedOnPercentage,
} from "./utils";

const config = Config.getInstance();
const logger = Logger.getInstance();
const timeoutStack = TimeoutStack.getInstance();

let isSurveyRunning = false;
let setIsError = (_: boolean): void => {};
let setIsResponseSendingFinished = (_: boolean): void => {};

export const setIsSurveyRunning = (value: boolean): void => {
  isSurveyRunning = value;
};

export const triggerSurvey = async (
  survey: TJsEnvironmentStateSurvey,
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
  survey: TJsEnvironmentStateSurvey,
  action?: string,
  hiddenFields: TResponseHiddenFieldValue = {}
): Promise<void> => {
  if (isSurveyRunning) {
    logger.debug("A survey is already running. Skipping.");
    return;
  }

  setIsSurveyRunning(true);

  if (survey.delay) {
    logger.debug(`Delaying survey "${survey.name}" by ${survey.delay.toString()} seconds.`);
  }

  const { project } = config.get().environmentState.data;
  const { attributes } = config.get();

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

  const surveyState = new SurveyState(survey.id, null, null, config.get().personState.data.userId);

  const responseQueue = new ResponseQueue(
    {
      apiHost: config.get().apiHost,
      environmentId: config.get().environmentId,
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

  const projectOverwrites = survey.projectOverwrites ?? {};
  const clickOutside = projectOverwrites.clickOutsideClose ?? project.clickOutsideClose;
  const darkOverlay = projectOverwrites.darkOverlay ?? project.darkOverlay;
  const placement = projectOverwrites.placement ?? project.placement;
  const isBrandingEnabled = project.inAppSurveyBranding;
  const formbricksSurveys = await loadFormbricksSurveysExternally();

  const timeoutId = setTimeout(() => {
    formbricksSurveys.renderSurveyModal({
      survey,
      isBrandingEnabled,
      clickOutside,
      darkOverlay,
      languageCode,
      placement,
      styling: getStyling(project, survey),
      getSetIsError: (f: (value: boolean) => void) => {
        setIsError = f;
      },
      getSetIsResponseSendingFinished: (f: (value: boolean) => void) => {
        setIsResponseSendingFinished = f;
      },
      onDisplay: async () => {
        const { userId } = config.get().personState.data;

        const api = new FormbricksAPI({
          apiHost: config.get().apiHost,
          environmentId: config.get().environmentId,
        });

        const res = await api.client.display.create({
          surveyId: survey.id,
          ...(userId && { userId }),
        });

        if (!res.ok) {
          throw new Error("Could not create display");
        }

        const { id } = res.data;

        surveyState.updateDisplayId(id);
        responseQueue.updateSurveyState(surveyState);

        const existingDisplays = config.get().personState.data.displays;
        const newDisplay = { surveyId: survey.id, createdAt: new Date() };
        const displays = existingDisplays.length ? [...existingDisplays, newDisplay] : [newDisplay];
        const previousConfig = config.get();

        const updatedPersonState: TJsPersonState = {
          ...previousConfig.personState,
          data: {
            ...previousConfig.personState.data,
            displays,
            lastDisplayAt: new Date(),
          },
        };

        const filteredSurveys = filterSurveys(previousConfig.environmentState, updatedPersonState);

        config.update({
          ...previousConfig,
          environmentState: previousConfig.environmentState,
          personState: updatedPersonState,
          filteredSurveys,
        });
      },
      onResponse: (responseUpdate: TResponseUpdate) => {
        const { userId } = config.get().personState.data;

        const isNewResponse = surveyState.responseId === null;

        if (userId) {
          surveyState.updateUserId(userId);
        }

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
          variables: responseUpdate.variables,
          hiddenFields,
          displayId: surveyState.displayId,
        });

        if (isNewResponse) {
          const responses = config.get().personState.data.responses;
          const newPersonState: TJsPersonState = {
            ...config.get().personState,
            data: {
              ...config.get().personState.data,
              responses: responses.length ? [...responses, surveyState.surveyId] : [surveyState.surveyId],
            },
          };

          const filteredSurveys = filterSurveys(config.get().environmentState, newPersonState);

          config.update({
            ...config.get(),
            environmentState: config.get().environmentState,
            personState: newPersonState,
            filteredSurveys,
          });
        }
      },
      onClose: closeSurvey,
      onFileUpload: async (file: TJsFileUploadParams["file"], params: TUploadFileConfig) => {
        const api = new FormbricksAPI({
          apiHost: config.get().apiHost,
          environmentId: config.get().environmentId,
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
        void responseQueue.processQueue();
      },
      hiddenFieldsRecord: hiddenFields,
    });
  }, survey.delay * 1000);

  if (action) {
    timeoutStack.add(action, timeoutId as unknown as number);
  }
};

export const closeSurvey = (): void => {
  // remove container element from DOM
  removeWidgetContainer();
  addWidgetContainer();

  const { environmentState, personState } = config.get();
  const filteredSurveys = filterSurveys(environmentState, personState);

  config.update({
    ...config.get(),
    environmentState,
    personState,
    filteredSurveys,
  });

  setIsSurveyRunning(false);
};

export const addWidgetContainer = (): void => {
  const containerElement = document.createElement("div");
  containerElement.id = CONTAINER_ID;
  document.body.appendChild(containerElement);
};

export const removeWidgetContainer = (): void => {
  document.getElementById(CONTAINER_ID)?.remove();
};

const loadFormbricksSurveysExternally = (): Promise<typeof window.formbricksSurveys> => {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- We need to check if the formbricksSurveys object exists
    if (window.formbricksSurveys) {
      resolve(window.formbricksSurveys);
    } else {
      const script = document.createElement("script");
      script.src = `${config.get().apiHost}/js/surveys.umd.cjs`;
      script.async = true;
      script.onload = () => {
        resolve(window.formbricksSurveys);
      };
      script.onerror = (error) => {
        console.error("Failed to load Formbricks Surveys library:", error);
        reject(new Error(`Failed to load Formbricks Surveys library: ${error as string}`));
      };
      document.head.appendChild(script);
    }
  });
};
