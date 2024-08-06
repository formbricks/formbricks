import { type TAttributes } from "@formbricks/types/attributes";
import { type TJSAppConfig, type TJsAppConfigInput } from "@formbricks/types/js";
import { updateAttributes } from "../../../js-core/src/app/lib/attributes";
import { sync } from "../../../js-core/src/app/lib/sync";
import {
  ErrorHandler,
  type MissingFieldError,
  type MissingPersonError,
  type NetworkError,
  type NotInitializedError,
  type Result,
  err,
  okVoid,
} from "../../../js-core/src/shared/errors";
import { Logger } from "../../../js-core/src/shared/logger";
import { trackAction } from "./actions";
import { appConfig } from "./config";

let isInitialized = false;
const logger = Logger.getInstance();

export const setIsInitialize = (state: boolean): void => {
  isInitialized = state;
};

export const initialize = async (
  c: TJsAppConfigInput
): Promise<Result<void, MissingFieldError | NetworkError | MissingPersonError>> => {
  if (isInitialized) {
    logger.debug("Already initialized, skipping initialization.");
    return okVoid();
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

  // if userId and attributes are available, set them in backend
  let updatedAttributes: TAttributes | null = null;
  if (c.userId && c.attributes) {
    const res = await updateAttributes(c.apiHost, c.environmentId, c.userId, c.attributes, appConfig);

    if (!res.ok) {
      return err(res.error);
    }
    updatedAttributes = res.value;
  }

  let existingConfig: TJSAppConfig | undefined;
  try {
    existingConfig = appConfig.get();
  } catch (e) {
    logger.debug("No existing configuration found.");
  }

  if (
    existingConfig?.state &&
    existingConfig.environmentId === c.environmentId &&
    existingConfig.apiHost === c.apiHost &&
    existingConfig.userId === c.userId &&
    Boolean(existingConfig.expiresAt) // only accept config when they follow new config version with expiresAt
  ) {
    logger.debug("Found existing configuration.");
    if (existingConfig.expiresAt < new Date()) {
      logger.debug("Configuration expired.");

      await sync(
        {
          apiHost: c.apiHost,
          environmentId: c.environmentId,
          userId: c.userId,
        },
        true,
        appConfig
      );
    } else {
      logger.debug("Configuration not expired. Extending expiration.");
      appConfig.update(existingConfig);
    }
  } else {
    logger.debug("No valid configuration found or it has been expired. Creating new config.");
    logger.debug("Syncing.");

    await sync(
      {
        apiHost: c.apiHost,
        environmentId: c.environmentId,
        userId: c.userId,
      },
      true,
      appConfig
    );

    // and track the new session event
    trackAction("New Session");
  }

  // todo: update attributes
  // update attributes in config
  if (updatedAttributes && Object.keys(updatedAttributes).length > 0) {
    appConfig.update({
      environmentId: appConfig.get().environmentId,
      apiHost: appConfig.get().apiHost,
      userId: appConfig.get().userId,
      state: {
        ...appConfig.get().state,
        attributes: { ...appConfig.get().state.attributes, ...c.attributes },
      },
      expiresAt: appConfig.get().expiresAt,
    });
  }

  setIsInitialize(true);
  logger.debug("Initialized");

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

export const deinitalize = async (): Promise<void> => {
  logger.debug("Deinitializing");
  // closeSurvey();
  await appConfig.resetConfig();
  setIsInitialize(false);
};
