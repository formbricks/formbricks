import { TAttributes } from "@formbricks/types/attributes";
import type { TJSAppConfig, TJsAppConfigInput } from "@formbricks/types/js";
import { APP_SURVEYS_LOCAL_STORAGE_KEY } from "../../shared/constants";
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
import { getIsDebug } from "../../shared/utils";
import { trackNoCodeAction } from "./actions";
import { updateAttributes } from "./attributes";
import { AppConfig } from "./config";
import { addCleanupEventListeners, addEventListeners, removeAllEventListeners } from "./eventListeners";
import { checkPageUrl } from "./noCodeActions";
import { sync } from "./sync";
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

  let existingConfig: TJSAppConfig | undefined;
  try {
    existingConfig = appConfig.get();
    logger.debug("Found existing configuration.");
  } catch (e) {
    logger.debug("No existing configuration found.");
  }

  // formbricks is in error state, skip initialization
  if (existingConfig?.status === "error") {
    if (isDebug) {
      logger.debug(
        "Formbricks is in error state, but debug mode is active. Resetting config and continuing."
      );
      appConfig.resetConfig();
      return okVoid();
    }

    logger.debug("Formbricks was set to an error state.");
    if (existingConfig?.expiresAt && new Date(existingConfig.expiresAt) > new Date()) {
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
    existingConfig.state &&
    existingConfig.environmentId === configInput.environmentId &&
    existingConfig.apiHost === configInput.apiHost &&
    existingConfig.userId === configInput.userId &&
    existingConfig.expiresAt // only accept config when they follow new config version with expiresAt
  ) {
    logger.debug("Configuration fits init parameters.");
    if (existingConfig.expiresAt < new Date()) {
      logger.debug("Configuration expired.");

      try {
        await sync(
          {
            apiHost: configInput.apiHost,
            environmentId: configInput.environmentId,
            userId: configInput.userId,
          },
          undefined,
          appConfig
        );
      } catch (e) {
        putFormbricksInErrorState();
      }
    } else {
      logger.debug("Configuration not expired. Extending expiration.");
      appConfig.update(existingConfig);
    }
  } else {
    logger.debug(
      "No valid configuration found or it has been expired. Resetting config and creating new one."
    );
    appConfig.resetConfig();
    logger.debug("Syncing.");

    try {
      await sync(
        {
          apiHost: configInput.apiHost,
          environmentId: configInput.environmentId,
          userId: configInput.userId,
        },
        undefined,
        appConfig
      );
    } catch (e) {
      handleErrorOnFirstInit();
    }

    // and track the new session event
    await trackNoCodeAction("New Session");
  }
  // update attributes in config
  if (updatedAttributes && Object.keys(updatedAttributes).length > 0) {
    appConfig.update({
      environmentId: appConfig.get().environmentId,
      apiHost: appConfig.get().apiHost,
      userId: appConfig.get().userId,
      state: {
        ...appConfig.get().state,
        attributes: { ...appConfig.get().state.attributes, ...configInput.attributes },
      },
      expiresAt: appConfig.get().expiresAt,
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

const handleErrorOnFirstInit = () => {
  if (getIsDebug()) {
    logger.debug("Not putting formbricks in error state because debug mode is active (no error state)");
    return;
  }

  // put formbricks in error state (by creating a new config) and throw error
  const initialErrorConfig: Partial<TJSAppConfig> = {
    status: "error",
    expiresAt: new Date(new Date().getTime() + 10 * 60000), // 10 minutes in the future
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
    status: "error",
    expiresAt: new Date(new Date().getTime() + 10 * 60000), // 10 minutes in the future
  });
  deinitalize();
};
