import { TAttributes } from "@formbricks/types/attributes";
import type { TJsAppConfigInput, TJsConfig } from "@formbricks/types/js";
import { APP_SURVEYS_LOCAL_STORAGE_KEY } from "../../shared/constants";
import { fetchEnvironmentState } from "../../shared/environmentState";
import {
  ErrorHandler,
  MissingFieldError,
  MissingPersonError,
  NetworkError,
  NotInitializedError,
  Result,
  err,
  okVoid,
  wrapThrows,
} from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { fetchPersonState } from "../../shared/personState";
import { filterSurveys, getIsDebug } from "../../shared/utils";
import { trackNoCodeAction } from "./actions";
import { updateAttributes } from "./attributes";
import { AppConfig } from "./config";
import { addCleanupEventListeners, addEventListeners, removeAllEventListeners } from "./eventListeners";
import { checkPageUrl } from "./noCodeActions";
import { addWidgetContainer, removeWidgetContainer, setIsSurveyRunning } from "./widget";

const appConfig = AppConfig.getInstance();
const logger = Logger.getInstance();

let isInitialized = false;

export const setIsInitialized = (value: boolean) => {
  isInitialized = value;
};

export const initialize = async (
  configInput: TJsAppConfigInput
): Promise<Result<void, MissingFieldError | NetworkError | MissingPersonError>> => {
  const isDebug = getIsDebug();
  if (isDebug) {
    logger.configure({ logLevel: "debug" });
  }

  if (isInitialized) {
    logger.debug("Already initialized, skipping initialization.");
    return okVoid();
  }

  let existingConfig: TJsConfig | undefined;
  try {
    existingConfig = appConfig.get();
    logger.debug("Found existing configuration.");
  } catch (e) {
    logger.debug("No existing configuration found.");
  }

  // formbricks is in error state, skip initialization
  if (existingConfig?.status?.value === "error") {
    if (isDebug) {
      logger.debug(
        "Formbricks is in error state, but debug mode is active. Resetting config and continuing."
      );
      appConfig.resetConfig();
      return okVoid();
    }

    logger.debug("Formbricks was set to an error state.");

    const expiresAt = existingConfig?.status?.expiresAt;

    if (expiresAt && new Date(expiresAt) > new Date()) {
      logger.debug("Error state is not expired, skipping initialization");
      return okVoid();
    } else {
      logger.debug("Error state is expired. Continue with initialization.");
    }
  }

  ErrorHandler.getInstance().printStatus();

  logger.debug("Start initialize");

  if (!configInput.environmentId) {
    logger.debug("No environmentId provided");
    return err({
      code: "missing_field",
      field: "environmentId",
    });
  }

  if (!configInput.apiHost) {
    logger.debug("No apiHost provided");

    return err({
      code: "missing_field",
      field: "apiHost",
    });
  }

  if (!configInput.userId) {
    logger.debug("No userId provided");

    return err({
      code: "missing_field",
      field: "userId",
    });
  }

  logger.debug("Adding widget container to DOM");
  addWidgetContainer();

  let updatedAttributes: TAttributes | null = null;
  if (configInput.attributes) {
    const res = await updateAttributes(
      configInput.apiHost,
      configInput.environmentId,
      configInput.userId,
      configInput.attributes,
      appConfig
    );
    if (res.ok !== true) {
      return err(res.error);
    }
    updatedAttributes = res.value;
  }

  if (
    existingConfig &&
    existingConfig.environmentState &&
    existingConfig.environmentId === configInput.environmentId &&
    existingConfig.apiHost === configInput.apiHost &&
    existingConfig.personState?.data?.userId === configInput.userId
  ) {
    logger.debug("Configuration fits init parameters.");
    let isEnvironmentStateExpired = false;
    let isPersonStateExpired = false;

    if (new Date(existingConfig.environmentState.expiresAt) < new Date()) {
      logger.debug("Environment state expired. Syncing.");
      isEnvironmentStateExpired = true;
    }

    if (existingConfig.personState.expiresAt && new Date(existingConfig.personState.expiresAt) < new Date()) {
      logger.debug("Person state expired. Syncing.");
      isPersonStateExpired = true;
    }

    try {
      // fetch the environment state (if expired)
      const environmentState = isEnvironmentStateExpired
        ? await fetchEnvironmentState(
            {
              apiHost: configInput.apiHost,
              environmentId: configInput.environmentId,
            },
            "app",
            false
          )
        : existingConfig.environmentState;

      // fetch the person state (if expired)
      const personState = isPersonStateExpired
        ? await fetchPersonState(
            {
              apiHost: configInput.apiHost,
              environmentId: configInput.environmentId,
              userId: configInput.userId,
            },
            false
          )
        : existingConfig.personState;

      // filter the environment state wrt the person state
      const filteredSurveys = filterSurveys(environmentState, personState);

      // update the appConfig with the new filtered surveys
      appConfig.update({
        ...existingConfig,
        environmentState,
        personState,
        filteredSurveys,
      });

      const surveyNames = filteredSurveys.map((s) => s.name);
      logger.debug("Fetched " + surveyNames.length + " surveys during sync: " + surveyNames.join(", "));
    } catch (e) {
      putFormbricksInErrorState();
    }
  } else {
    logger.debug(
      "No valid configuration found or it has been expired. Resetting config and creating new one."
    );
    appConfig.resetConfig();
    logger.debug("Syncing.");

    try {
      const environmentState = await fetchEnvironmentState(
        {
          apiHost: configInput.apiHost,
          environmentId: configInput.environmentId,
        },
        "app",
        false
      );
      const personState = await fetchPersonState(
        {
          apiHost: configInput.apiHost,
          environmentId: configInput.environmentId,
          userId: configInput.userId,
        },
        false
      );

      const filteredSurveys = filterSurveys(environmentState, personState);

      appConfig.update({
        apiHost: configInput.apiHost,
        environmentId: configInput.environmentId,
        personState,
        environmentState,
        filteredSurveys,
      });
    } catch (e) {
      handleErrorOnFirstInit();
    }

    // and track the new session event
    await trackNoCodeAction("New Session");
  }

  // update attributes in config
  if (updatedAttributes && Object.keys(updatedAttributes).length > 0) {
    appConfig.update({
      ...appConfig.get(),
      personState: {
        ...appConfig.get().personState,
        data: {
          ...appConfig.get().personState.data,
          attributes: {
            ...appConfig.get().personState.data.attributes,
            ...updatedAttributes,
          },
        },
      },
    });
  }

  logger.debug("Adding event listeners");
  addEventListeners(appConfig);
  addCleanupEventListeners();

  setIsInitialized(true);
  logger.debug("Initialized");

  // check page url if initialized after page load

  checkPageUrl();
  return okVoid();
};

export const handleErrorOnFirstInit = () => {
  if (getIsDebug()) {
    logger.debug("Not putting formbricks in error state because debug mode is active (no error state)");
    return;
  }

  // put formbricks in error state (by creating a new config) and throw error
  const initialErrorConfig: Partial<TJsConfig> = {
    status: {
      value: "error",
      expiresAt: new Date(new Date().getTime() + 10 * 60000), // 10 minutes in the future
    },
  };

  // can't use config.update here because the config is not yet initialized
  wrapThrows(() => localStorage.setItem(APP_SURVEYS_LOCAL_STORAGE_KEY, JSON.stringify(initialErrorConfig)))();
  throw new Error("Could not initialize formbricks");
};

export const checkInitialized = (): Result<void, NotInitializedError> => {
  logger.debug("Check if initialized");
  if (!isInitialized || !ErrorHandler.initialized) {
    return err({
      code: "not_initialized",
      message: "Formbricks not initialized. Call initialize() first.",
    });
  }

  return okVoid();
};

export const deinitalize = (): void => {
  logger.debug("Deinitializing");
  removeWidgetContainer();
  setIsSurveyRunning(false);
  removeAllEventListeners();
  setIsInitialized(false);
};

export const putFormbricksInErrorState = (): void => {
  if (getIsDebug()) {
    logger.debug("Not putting formbricks in error state because debug mode is active (no error state)");
    return;
  }

  logger.debug("Putting formbricks in error state");
  // change formbricks status to error
  appConfig.update({
    ...appConfig.get(),
    status: {
      value: "error",
      expiresAt: new Date(new Date().getTime() + 10 * 60000), // 10 minutes in the future
    },
  });
  deinitalize();
};
