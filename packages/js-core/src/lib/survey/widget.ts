/* eslint-disable no-console -- Required for error logging */
/* eslint-disable @typescript-eslint/no-empty-function -- There are some empty functions here that we need */
import { Config } from "@/lib/common/config";
import { CONTAINER_ID } from "@/lib/common/constants";
import { Logger } from "@/lib/common/logger";
import { ResponseQueue } from "@/lib/common/response-queue";
import { TimeoutStack } from "@/lib/common/timeout-stack";
import {
  filterSurveys,
  getDefaultLanguageCode,
  getLanguageCode,
  shouldDisplayBasedOnPercentage,
} from "@/lib/common/utils";
import { getStyling } from "@/lib/common/utils";
import { SurveyState } from "@/lib/survey/state";
import { TEnvironmentStateSurvey, TUserState } from "@/types/config";
import { TResponseHiddenFieldValue, TResponseUpdate } from "@/types/response";
import { TFileUploadParams, TUploadFileConfig } from "@/types/storage";
import { FormbricksAPI } from "@formbricks/api";

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
  survey: TEnvironmentStateSurvey,
  action?: string
  // properties?: TJsTrackProperties
): Promise<void> => {
  // Check if the survey should be displayed based on displayPercentage
  if (survey.displayPercentage) {
    const shouldDisplaySurvey = shouldDisplayBasedOnPercentage(survey.displayPercentage);
    if (!shouldDisplaySurvey) {
      logger.debug(`Survey display of "${survey.name}" skipped based on displayPercentage.`);
      return; // skip displaying the survey
    }
  }

  // const hiddenFieldsObject: TResponseHiddenFieldValue = handleHiddenFields(
  //   survey.hiddenFields,
  //   properties?.hiddenFields
  // );

  await renderWidget(survey, action);
};

const renderWidget = async (
  survey: TEnvironmentStateSurvey,
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

  const { project } = config.get().environment.data;
  const { language } = config.get().user.data;

  const isMultiLanguageSurvey = survey.languages.length > 1;
  let languageCode = "default";

  if (isMultiLanguageSurvey) {
    const displayLanguage = getLanguageCode(survey, language);
    //if survey is not available in selected language, survey wont be shown
    if (!displayLanguage) {
      logger.debug(`Survey "${survey.name}" is not available in specified language.`);
      setIsSurveyRunning(true);
      return;
    }
    languageCode = displayLanguage;
  }

  const surveyState = new SurveyState(survey.id, null, null, config.get().user.data.userId);

  const responseQueue = new ResponseQueue(
    {
      appUrl: config.get().appUrl,
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
        const { userId } = config.get().user.data;

        const api = new FormbricksAPI({
          apiHost: config.get().appUrl,
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

        const existingDisplays = config.get().user.data.displays;
        const newDisplay = { surveyId: survey.id, createdAt: new Date() };
        const displays = existingDisplays.length ? [...existingDisplays, newDisplay] : [newDisplay];
        const previousConfig = config.get();

        const updatedUserState: TUserState = {
          ...previousConfig.user,
          data: {
            ...previousConfig.user.data,
            displays,
            lastDisplayAt: new Date(),
          },
        };

        const filteredSurveys = filterSurveys(previousConfig.environment, updatedUserState);

        config.update({
          ...previousConfig,
          environment: previousConfig.environment,
          user: updatedUserState,
          filteredSurveys,
        });
      },
      onResponse: (responseUpdate: TResponseUpdate) => {
        const { userId } = config.get().user.data;

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
          const responses = config.get().user.data.responses;
          const newUserState: TUserState = {
            ...config.get().user,
            data: {
              ...config.get().user.data,
              responses: responses.length ? [...responses, surveyState.surveyId] : [surveyState.surveyId],
            },
          };

          const filteredSurveys = filterSurveys(config.get().environment, newUserState);

          config.update({
            ...config.get(),
            environment: config.get().environment,
            user: newUserState,
            filteredSurveys,
          });
        }
      },
      onClose: closeSurvey,
      onFileUpload: async (file: TFileUploadParams["file"], params: TUploadFileConfig) => {
        const api = new FormbricksAPI({
          apiHost: config.get().appUrl,
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

  const { environment, user } = config.get();
  const filteredSurveys = filterSurveys(environment, user);

  config.update({
    ...config.get(),
    environment,
    user,
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
      script.src = `${config.get().appUrl}/js/surveys.umd.cjs`;
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
