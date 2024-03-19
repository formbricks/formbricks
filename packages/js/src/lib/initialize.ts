import type { TJsConfig, TJsConfigInput } from "@formbricks/types/js";
import { TPersonAttributes } from "@formbricks/types/people";

import { trackAction } from "./actions";
import { Config, LOCAL_STORAGE_KEY } from "./config";
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
import { updatePersonAttributes } from "./person";
import { sync } from "./sync";
import { getIsDebug } from "./utils";
import { addWidgetContainer, removeWidgetContainer, setIsSurveyRunning } from "./widget";

const config = Config.getInstance();
const logger = Logger.getInstance();

let isInitialized = false;

export const setIsInitialized = (value: boolean) => {
  isInitialized = value;
};

export const initialize = async (
  c: TJsConfigInput
): Promise<Result<void, MissingFieldError | NetworkError | MissingPersonError>> => {
  if (getIsDebug()) {
    logger.configure({ logLevel: "debug" });
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
  if (existingConfig?.status === "error") {
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

  if (!c.environmentId) {
    logger.debug("No environmentId provided");
    return err({
      code: "missing_field",
      field: "environmentId",
    });
  }

  if (!c.apiHost) {
    logger.debug("No apiHost provided");

    return err({
      code: "missing_field",
      field: "apiHost",
    });
  }

  logger.debug("Adding widget container to DOM");
  addWidgetContainer();

  let updatedAttributes: TPersonAttributes | null = null;
  if (c.attributes) {
    if (!c.userId) {
      // Allow setting attributes for unidentified users
      updatedAttributes = { ...c.attributes };
    }
    // If userId is available, update attributes in backend
    else {
      const res = await updatePersonAttributes(c.apiHost, c.environmentId, c.userId, c.attributes);
      if (res.ok !== true) {
        return err(res.error);
      }
      updatedAttributes = res.value;
    }
  }

  if (
    existingConfig &&
    existingConfig.state &&
    existingConfig.environmentId === c.environmentId &&
    existingConfig.apiHost === c.apiHost &&
    existingConfig.userId === c.userId &&
    existingConfig.expiresAt // only accept config when they follow new config version with expiresAt
  ) {
    logger.debug("Configuration fits init parameters.");
    if (existingConfig.expiresAt < new Date()) {
      logger.debug("Configuration expired.");

      try {
        await sync({
          apiHost: c.apiHost,
          environmentId: c.environmentId,
          userId: c.userId,
        });
      } catch (e) {
        putFormbricksInErrorState();
      }
    } else {
      logger.debug("Configuration not expired. Extending expiration.");
      config.update(existingConfig);
    }
  } else {
    logger.debug(
      "No valid configuration found or it has been expired. Resetting config and creating new one."
    );
    config.resetConfig();
    logger.debug("Syncing.");

    try {
      await sync({
        apiHost: c.apiHost,
        environmentId: c.environmentId,
        userId: c.userId,
      });
    } catch (e) {
      handleErrorOnFirstInit();
    }
    // and track the new session event
    await trackAction("New Session");
  }
  // update attributes in config
  if (updatedAttributes && Object.keys(updatedAttributes).length > 0) {
    config.update({
      environmentId: config.get().environmentId,
      apiHost: config.get().apiHost,
      userId: config.get().userId,
      state: {
        ...config.get().state,
        attributes: { ...config.get().state.attributes, ...c.attributes },
      },
      expiresAt: config.get().expiresAt,
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
  // put formbricks in error state (by creating a new config) and throw error
  const initialErrorConfig: Partial<TJsConfig> = {
    status: "error",
    expiresAt: new Date(new Date().getTime() + 10 * 60000), // 10 minutes in the future
  };
  // can't use config.update here because the config is not yet initialized
  wrapThrows(() => localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(initialErrorConfig)))();
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
  logger.debug("Putting formbricks in error state");
  // change formbricks status to error
  config.update({
    ...config.get(),
    status: "error",
    expiresAt: new Date(new Date().getTime() + 10 * 60000), // 10 minutes in the future
  });
  deinitalize();
};
