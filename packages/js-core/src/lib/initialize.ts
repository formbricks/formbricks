import { TAttributes } from "@formbricks/types/attributes";
import { type TJsConfig, type TJsConfigInput } from "@formbricks/types/js";
import { trackNoCodeAction } from "./actions";
import { updateAttributes } from "./attributes";
import { Config } from "./config";
import {
  JS_LOCAL_STORAGE_KEY,
  LEGACY_JS_APP_LOCAL_STORAGE_KEY,
  LEGACY_JS_WEBSITE_LOCAL_STORAGE_KEY,
} from "./constants";
import { fetchEnvironmentState } from "./environmentState";
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
} from "./errors";
import { addCleanupEventListeners, addEventListeners, removeAllEventListeners } from "./eventListeners";
import { Logger } from "./logger";
import { checkPageUrl } from "./noCodeActions";
import { DEFAULT_PERSON_STATE_NO_USER_ID, fetchPersonState } from "./personState";
import { filterSurveys, getIsDebug } from "./utils";
import { addWidgetContainer, removeWidgetContainer, setIsSurveyRunning } from "./widget";

const logger = Logger.getInstance();

let isInitialized = false;

export const setIsInitialized = (value: boolean) => {
  isInitialized = value;
};

const migrateLocalStorage = (): { changed: boolean; newState?: TJsConfig } => {
  const oldWebsiteConfig = localStorage.getItem(LEGACY_JS_WEBSITE_LOCAL_STORAGE_KEY);
  const oldAppConfig = localStorage.getItem(LEGACY_JS_APP_LOCAL_STORAGE_KEY);

  if (oldWebsiteConfig) {
    localStorage.removeItem(LEGACY_JS_WEBSITE_LOCAL_STORAGE_KEY);
    const parsedOldConfig = JSON.parse(oldWebsiteConfig) as TJsConfig;

    if (
      parsedOldConfig.environmentId &&
      parsedOldConfig.apiHost &&
      parsedOldConfig.environmentState &&
      parsedOldConfig.personState &&
      parsedOldConfig.filteredSurveys
    ) {
      const newLocalStorageConfig = { ...parsedOldConfig };

      return {
        changed: true,
        newState: newLocalStorageConfig,
      };
    }
  }

  if (oldAppConfig) {
    localStorage.removeItem(LEGACY_JS_APP_LOCAL_STORAGE_KEY);
    const parsedOldConfig = JSON.parse(oldAppConfig) as TJsConfig;

    if (
      parsedOldConfig.environmentId &&
      parsedOldConfig.apiHost &&
      parsedOldConfig.environmentState &&
      parsedOldConfig.personState &&
      parsedOldConfig.filteredSurveys
    ) {
      return {
        changed: true,
      };
    }
  }

  return {
    changed: false,
  };
};

export const initialize = async (
  configInput: TJsConfigInput
): Promise<Result<void, MissingFieldError | NetworkError | MissingPersonError>> => {
  const isDebug = getIsDebug();
  if (isDebug) {
    logger.configure({ logLevel: "debug" });
  }
  let config = Config.getInstance();

  const { changed, newState } = migrateLocalStorage();

  if (changed) {
    config.resetConfig();
    config = Config.getInstance();

    // If the js sdk is being used for non identified users, and we have a new state to update to after migrating, we update the state
    // otherwise, we just sync again!
    if (!configInput.userId && newState) {
      config.update(newState);
    }
  }

  if (isInitialized) {
    logger.debug("Already initialized, skipping initialization.");
    return okVoid();
  }

  let existingConfig: TJsConfig | undefined;
  try {
    existingConfig = config.get();
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
      config.resetConfig();
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

  logger.debug("Adding widget container to DOM");
  addWidgetContainer();

  let updatedAttributes: TAttributes | null = null;
  if (configInput.attributes) {
    if (configInput.userId) {
      const res = await updateAttributes(
        configInput.apiHost,
        configInput.environmentId,
        configInput.userId,
        configInput.attributes
      );
      if (res.ok !== true) {
        return err(res.error);
      }
      updatedAttributes = res.value;
    } else {
      updatedAttributes = { ...configInput.attributes };
    }
  }

  if (
    existingConfig &&
    existingConfig.environmentState &&
    existingConfig.environmentId === configInput.environmentId &&
    existingConfig.apiHost === configInput.apiHost
  ) {
    logger.debug("Configuration fits init parameters.");
    let isEnvironmentStateExpired = false;
    let isPersonStateExpired = false;

    if (new Date(existingConfig.environmentState.expiresAt) < new Date()) {
      logger.debug("Environment state expired. Syncing.");
      isEnvironmentStateExpired = true;
    }

    // if the config has a userId and the person state has expired, we need to sync the person state
    if (
      configInput.userId &&
      existingConfig.personState.expiresAt &&
      new Date(existingConfig.personState.expiresAt) < new Date()
    ) {
      logger.debug("Person state expired. Syncing.");
      isPersonStateExpired = true;
    }

    try {
      // fetch the environment state (if expired)
      const environmentState = isEnvironmentStateExpired
        ? await fetchEnvironmentState({
            apiHost: configInput.apiHost,
            environmentId: configInput.environmentId,
          })
        : existingConfig.environmentState;

      // fetch the person state (if expired)

      let { personState } = existingConfig;

      if (isPersonStateExpired) {
        if (configInput.userId) {
          personState = await fetchPersonState({
            apiHost: configInput.apiHost,
            environmentId: configInput.environmentId,
            userId: configInput.userId,
          });
        } else {
          personState = DEFAULT_PERSON_STATE_NO_USER_ID;
        }
      }

      // filter the environment state wrt the person state
      const filteredSurveys = filterSurveys(environmentState, personState);

      // update the appConfig with the new filtered surveys
      config.update({
        ...existingConfig,
        environmentState,
        personState,
        filteredSurveys,
      });

      const surveyNames = filteredSurveys.map((s) => s.name);
      logger.debug("Fetched " + surveyNames.length + " surveys during sync: " + surveyNames.join(", "));
    } catch (e) {
      putFormbricksInErrorState(config);
    }
  } else {
    logger.debug(
      "No valid configuration found or it has been expired. Resetting config and creating new one."
    );
    config.resetConfig();
    logger.debug("Syncing.");

    try {
      const environmentState = await fetchEnvironmentState(
        {
          apiHost: configInput.apiHost,
          environmentId: configInput.environmentId,
        },
        false
      );
      const personState = configInput.userId
        ? await fetchPersonState(
            {
              apiHost: configInput.apiHost,
              environmentId: configInput.environmentId,
              userId: configInput.userId,
            },
            false
          )
        : DEFAULT_PERSON_STATE_NO_USER_ID;

      const filteredSurveys = filterSurveys(environmentState, personState);

      config.update({
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
    config.update({
      ...config.get(),
      personState: {
        ...config.get().personState,
        data: {
          ...config.get().personState.data,
          attributes: {
            ...config.get().personState.data.attributes,
            ...updatedAttributes,
          },
        },
      },
    });
  }

  logger.debug("Adding event listeners");
  addEventListeners();
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
  wrapThrows(() => localStorage.setItem(JS_LOCAL_STORAGE_KEY, JSON.stringify(initialErrorConfig)))();
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

export const putFormbricksInErrorState = (config: Config): void => {
  if (getIsDebug()) {
    logger.debug("Not putting formbricks in error state because debug mode is active (no error state)");
    return;
  }

  logger.debug("Putting formbricks in error state");
  // change formbricks status to error
  config.update({
    ...config.get(),
    status: {
      value: "error",
      expiresAt: new Date(new Date().getTime() + 10 * 60000), // 10 minutes in the future
    },
  });
  deinitalize();
};
