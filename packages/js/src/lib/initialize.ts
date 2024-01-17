import type { TJsConfig, TJsConfigInput } from "@formbricks/types/js";
import { TPersonAttributes } from "@formbricks/types/people";

import { trackAction } from "./actions";
import { Config } from "./config";
import {
  ErrorHandler,
  MissingFieldError,
  MissingPersonError,
  NetworkError,
  NotInitializedError,
  Result,
  err,
  okVoid,
} from "./errors";
import { addCleanupEventListeners, addEventListeners, removeAllEventListeners } from "./eventListeners";
import { Logger } from "./logger";
import { checkPageUrl } from "./noCodeActions";
import { updatePersonAttributes } from "./person";
import { sync } from "./sync";
import { addWidgetContainer, closeSurvey } from "./widget";

const config = Config.getInstance();
const logger = Logger.getInstance();

let isInitialized = false;

const setDebugLevel = (c: TJsConfigInput): void => {
  if (c.debug) {
    logger.debug(`Setting log level to debug`);
    logger.configure({ logLevel: "debug" });
  }
};

export const initialize = async (
  c: TJsConfigInput
): Promise<Result<void, MissingFieldError | NetworkError | MissingPersonError>> => {
  if (isInitialized) {
    logger.debug("Already initialized, skipping initialization.");
    return okVoid();
  }

  setDebugLevel(c);

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

  if (!c.userId && c.attributes) {
    logger.error("No userId provided but attributes. Cannot update attributes without userId.");
    return err({
      code: "missing_field",
      field: "userId",
    });
  }
  // if userId and attributes are available, set them in backend
  let updatedAttributes: TPersonAttributes | null = null;
  if (c.userId && c.attributes) {
    const res = await updatePersonAttributes(c.apiHost, c.environmentId, c.userId, c.attributes);

    if (res.ok !== true) {
      return err(res.error);
    }
    updatedAttributes = res.value;
  }

  let existingConfig: TJsConfig | undefined;
  try {
    existingConfig = config.get();
  } catch (e) {
    logger.debug("No existing configuration found.");
  }
  if (
    existingConfig &&
    existingConfig.state &&
    existingConfig.environmentId === c.environmentId &&
    existingConfig.apiHost === c.apiHost &&
    existingConfig.userId === c.userId &&
    existingConfig.expiresAt &&
    existingConfig.language === c.language // only accept config when they follow new config version with expiresAt
  ) {
    logger.debug("Found existing configuration.");
    if (existingConfig.expiresAt < new Date()) {
      logger.debug("Configuration expired.");

      await sync({
        apiHost: c.apiHost,
        environmentId: c.environmentId,
        userId: c.userId,
        language: c.language,
      });
    } else {
      logger.debug("Configuration not expired. Extending expiration.");
      config.update(existingConfig);
    }
  } else {
    logger.debug("No valid configuration found or it has been expired. Creating new config.");
    logger.debug("Syncing.");

    await sync({
      apiHost: c.apiHost,
      environmentId: c.environmentId,
      userId: c.userId,
      language: c.language,
    });

    // and track the new session event
    await trackAction("New Session");
  }

  // update attributes in config
  if (updatedAttributes && Object.keys(updatedAttributes).length > 0) {
    config.update({
      environmentId: config.get().environmentId,
      apiHost: config.get().apiHost,
      userId: config.get().userId,
      language: config.get().language,
      state: {
        ...config.get().state,
        attributes: { ...config.get().state.attributes, ...c.attributes },
      },
    });
  }

  logger.debug("Adding event listeners");
  addEventListeners();
  addCleanupEventListeners();

  isInitialized = true;
  logger.debug("Initialized");

  // check page url if initialized after page load

  checkPageUrl();
  return okVoid();
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
  closeSurvey();
  removeAllEventListeners();
  config.resetConfig();
  isInitialized = false;
};
