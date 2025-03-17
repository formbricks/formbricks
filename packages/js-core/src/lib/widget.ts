/* eslint-disable no-console -- Required for error logging */
import { getStyling } from "@formbricks/lib/utils/styling";
import {
  type TJsEnvironmentStateSurvey,
  type TJsPersonState,
  type TJsTrackProperties,
} from "@formbricks/types/js";
import { type TResponseHiddenFieldValue } from "@formbricks/types/responses";
import { Config } from "./config";
import { CONTAINER_ID } from "./constants";
import { Logger } from "./logger";
import { TimeoutStack } from "./timeout-stack";
import { filterSurveys, getLanguageCode, handleHiddenFields, shouldDisplayBasedOnPercentage } from "./utils";

const config = Config.getInstance();
const logger = Logger.getInstance();
const timeoutStack = TimeoutStack.getInstance();

let isSurveyRunning = false;

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

  const projectOverwrites = survey.projectOverwrites ?? {};
  const clickOutside = projectOverwrites.clickOutsideClose ?? project.clickOutsideClose;
  const darkOverlay = projectOverwrites.darkOverlay ?? project.darkOverlay;
  const placement = projectOverwrites.placement ?? project.placement;
  const isBrandingEnabled = project.inAppSurveyBranding;
  const formbricksSurveys = await loadFormbricksSurveysExternally();

  const timeoutId = setTimeout(() => {
    formbricksSurveys.renderSurvey({
      apiHost: config.get().apiHost,
      environmentId: config.get().environmentId,
      contactId: config.get().personState.data.contactId ?? undefined,
      action,
      survey,
      isBrandingEnabled,
      clickOutside,
      darkOverlay,
      languageCode,
      placement,
      styling: getStyling(project, survey),
      onDisplayCreated: () => {
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
      onResponseCreated: () => {
        const responses = config.get().personState.data.responses;
        const newPersonState: TJsPersonState = {
          ...config.get().personState,
          data: {
            ...config.get().personState.data,
            responses: responses.length ? [...responses, survey.id] : [survey.id],
          },
        };

        const filteredSurveys = filterSurveys(config.get().environmentState, newPersonState);

        config.update({
          ...config.get(),
          environmentState: config.get().environmentState,
          personState: newPersonState,
          filteredSurveys,
        });
      },
      onClose: closeSurvey,
      hiddenFieldsRecord: hiddenFields,
      getSetIsResponseSendingFinished: (_f: (value: boolean) => void) => undefined,
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
