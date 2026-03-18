/* eslint-disable no-console -- Required for error logging */
import { Config } from "@/lib/common/config";
import { CONTAINER_ID } from "@/lib/common/constants";
import { Logger } from "@/lib/common/logger";
import { executeRecaptcha, loadRecaptchaScript } from "@/lib/common/recaptcha";
import { TimeoutStack } from "@/lib/common/timeout-stack";
import {
  filterSurveys,
  getLanguageCode,
  getStyling,
  handleHiddenFields,
  shouldDisplayBasedOnPercentage,
} from "@/lib/common/utils";
import { UpdateQueue } from "@/lib/user/update-queue";
import { type TEnvironmentStateSurvey, type TUserState } from "@/types/config";
import { type TTrackProperties } from "@/types/survey";

let isSurveyRunning = false;

export const setIsSurveyRunning = (value: boolean): void => {
  isSurveyRunning = value;
};

export const triggerSurvey = async (
  survey: TEnvironmentStateSurvey,
  action?: string,
  properties?: TTrackProperties
): Promise<void> => {
  const logger = Logger.getInstance();

  // Check if the survey should be displayed based on displayPercentage
  if (survey.displayPercentage) {
    const shouldDisplaySurvey = shouldDisplayBasedOnPercentage(survey.displayPercentage);
    if (!shouldDisplaySurvey) {
      logger.debug(`Survey display of "${survey.name}" skipped based on displayPercentage.`);
      return; // skip displaying the survey
    }
  }

  const hiddenFieldsObject: TTrackProperties["hiddenFields"] = handleHiddenFields(
    survey.hiddenFields,
    properties?.hiddenFields
  );

  await renderWidget(survey, action, hiddenFieldsObject);
};

export const renderWidget = async (
  survey: TEnvironmentStateSurvey,
  action?: string,
  hiddenFieldsObject?: TTrackProperties["hiddenFields"]
): Promise<void> => {
  const logger = Logger.getInstance();
  const config = Config.getInstance();
  const timeoutStack = TimeoutStack.getInstance();

  if (isSurveyRunning) {
    logger.debug("A survey is already running. Skipping.");
    return;
  }

  setIsSurveyRunning(true);

  // Wait for pending user identification to complete before rendering
  const updateQueue = UpdateQueue.getInstance();
  if (updateQueue.hasPendingWork()) {
    logger.debug("Waiting for pending user identification before rendering survey");
    const identificationSucceeded = await updateQueue.waitForPendingWork();
    if (!identificationSucceeded) {
      const hasSegmentFilters = Array.isArray(survey.segment?.filters) && survey.segment.filters.length > 0;

      if (hasSegmentFilters) {
        logger.debug("User identification failed. Skipping survey with segment filters.");
        setIsSurveyRunning(false);
        return;
      }

      logger.debug("User identification failed but survey has no segment filters. Proceeding.");
    }
  }

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
      setIsSurveyRunning(false);
      return;
    }

    languageCode = displayLanguage;
  }

  const projectOverwrites = survey.projectOverwrites ?? {};
  const clickOutside = projectOverwrites.clickOutsideClose ?? project.clickOutsideClose;
  const overlay = projectOverwrites.overlay ?? project.overlay;
  const placement = projectOverwrites.placement ?? project.placement;
  const isBrandingEnabled = project.inAppSurveyBranding;
  const formbricksSurveys = await loadFormbricksSurveysExternally();

  const recaptchaSiteKey = config.get().environment.data.recaptchaSiteKey;
  const isSpamProtectionEnabled = Boolean(recaptchaSiteKey && survey.recaptcha?.enabled);

  const getRecaptchaToken = (): Promise<string | null> => {
    return executeRecaptcha(recaptchaSiteKey);
  };

  if (isSpamProtectionEnabled && recaptchaSiteKey) {
    await loadRecaptchaScript(recaptchaSiteKey);
  }

  const timeoutId = setTimeout(() => {
    formbricksSurveys.renderSurvey({
      appUrl: config.get().appUrl,
      environmentId: config.get().environmentId,
      contactId: config.get().user.data.contactId ?? undefined,
      action,
      // @ts-expect-error -- the types are not compatible because they come from different places (types package vs local types)
      survey,
      isBrandingEnabled,
      clickOutside,
      overlay,
      languageCode,
      placement,
      styling: getStyling(project, survey),
      hiddenFieldsRecord: hiddenFieldsObject,
      recaptchaSiteKey,
      isSpamProtectionEnabled,
      getRecaptchaToken,
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
        const newPersonState: TUserState = {
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
      getSetIsResponseSendingFinished: (_f: (value: boolean) => void) => undefined,
    });
  }, survey.delay * 1000);

  if (action) {
    timeoutStack.add(action, timeoutId as unknown as number);
  }
};

export const closeSurvey = (): void => {
  const config = Config.getInstance();

  // remove the survey modal container from DOM
  removeWidgetContainer();

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

const SURVEYS_LOAD_TIMEOUT_MS = 10000;
const SURVEYS_POLL_INTERVAL_MS = 200;

type TFormbricksSurveys = typeof globalThis.window.formbricksSurveys;

let surveysLoadPromise: Promise<TFormbricksSurveys> | null = null;

const waitForSurveysGlobal = (): Promise<TFormbricksSurveys> => {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const check = (): void => {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime check for surveys package availability
      if (globalThis.window.formbricksSurveys) {
        const storedNonce = globalThis.window.__formbricksNonce;
        if (storedNonce) {
          globalThis.window.formbricksSurveys.setNonce(storedNonce);
        }
        resolve(globalThis.window.formbricksSurveys);
        return;
      }

      if (Date.now() - startTime >= SURVEYS_LOAD_TIMEOUT_MS) {
        reject(new Error("Formbricks Surveys library did not become available within timeout"));
        return;
      }

      setTimeout(check, SURVEYS_POLL_INTERVAL_MS);
    };

    check();
  });
};

const loadFormbricksSurveysExternally = (): Promise<TFormbricksSurveys> => {
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime check for surveys package availability
  if (globalThis.window.formbricksSurveys) {
    return Promise.resolve(globalThis.window.formbricksSurveys);
  }

  if (surveysLoadPromise) {
    return surveysLoadPromise;
  }

  surveysLoadPromise = new Promise<TFormbricksSurveys>((resolve, reject) => {
    const config = Config.getInstance();
    const script = document.createElement("script");
    script.src = `${config.get().appUrl}/js/surveys.umd.cjs`;
    script.async = true;
    script.onload = () => {
      waitForSurveysGlobal().then(resolve).catch(reject);
    };
    script.onerror = (error) => {
      surveysLoadPromise = null;
      console.error("Failed to load Formbricks Surveys library:", error);
      reject(new Error(`Failed to load Formbricks Surveys library: ${error as string}`));
    };
    document.head.appendChild(script);
  });

  return surveysLoadPromise;
};

let isPreloaded = false;

export const preloadSurveysScript = (appUrl: string): void => {
  // Don't preload if already loaded or already preloading
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Runtime check for surveys package availability
  if (globalThis.window.formbricksSurveys) return;
  if (isPreloaded) return;

  isPreloaded = true;
  const link = document.createElement("link");
  link.rel = "preload";
  link.as = "script";
  link.href = `${appUrl}/js/surveys.umd.cjs`;
  document.head.appendChild(link);
};
