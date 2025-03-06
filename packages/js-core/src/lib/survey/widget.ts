/* eslint-disable no-console -- Required for error logging */
import { type TJsPersonState } from "@formbricks/types/js";
import { type TResponseHiddenFieldValue } from "@formbricks/types/responses";
import { Config } from "@/lib/common/config";
import { CONTAINER_ID } from "@/lib/common/constants";
import { Logger } from "@/lib/common/logger";
import { TimeoutStack } from "@/lib/common/timeout-stack";
import {
  filterSurveys,
  getLanguageCode,
  getStyling,
  shouldDisplayBasedOnPercentage,
} from "@/lib/common/utils";
import { type TEnvironmentStateSurvey, type TUserState } from "@/types/config";

const config = Config.getInstance();
const logger = Logger.getInstance();
const timeoutStack = TimeoutStack.getInstance();

let isSurveyRunning = false;

export const setIsSurveyRunning = (value: boolean): void => {
  isSurveyRunning = value;
};

export const triggerSurvey = async (survey: TEnvironmentStateSurvey, action?: string): Promise<void> => {
  // Check if the survey should be displayed based on displayPercentage
  if (survey.displayPercentage) {
    const shouldDisplaySurvey = shouldDisplayBasedOnPercentage(survey.displayPercentage);
    if (!shouldDisplaySurvey) {
      logger.debug(`Survey display of "${survey.name}" skipped based on displayPercentage.`);
      return; // skip displaying the survey
    }
  }

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

  const projectOverwrites = survey.projectOverwrites ?? {};
  const clickOutside = projectOverwrites.clickOutsideClose ?? project.clickOutsideClose;
  const darkOverlay = projectOverwrites.darkOverlay ?? project.darkOverlay;
  const placement = projectOverwrites.placement ?? project.placement;
  const isBrandingEnabled = project.inAppSurveyBranding;
  const formbricksSurveys = await loadFormbricksSurveysExternally();

  const timeoutId = setTimeout(() => {
    formbricksSurveys.renderSurvey({
      apiHost: config.get().appUrl,
      environmentId: config.get().environmentId,
      userId: config.get().user.data.userId ?? undefined,
      action,
      // @ts-expect-error -- the types are not compatible because they come from different places (types package vs local types)
      survey,
      isBrandingEnabled,
      clickOutside,
      darkOverlay,
      languageCode,
      placement,
      styling: getStyling(project, survey),
      onDisplayCreated: () => {
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
      onResponseCreated: () => {
        const responses = config.get().user.data.responses;
        const newPersonState: TJsPersonState = {
          ...config.get().user,
          data: {
            ...config.get().user.data,
            responses: responses.length ? [...responses, survey.id] : [survey.id],
          },
        };

        const filteredSurveys = filterSurveys(config.get().environment, newPersonState);

        config.update({
          ...config.get(),
          environment: config.get().environment,
          user: newPersonState,
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
