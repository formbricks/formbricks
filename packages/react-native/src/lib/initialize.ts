import { ErrorHandler, NotInitializedError, err, okVoid } from "@formbricks/lib/errors";
import type { MissingFieldError, MissingPersonError, NetworkError, Result } from "@formbricks/lib/errors";
import { isInitialized, setIsInitialize } from "@formbricks/lib/initializationState";
import { Logger } from "@formbricks/lib/logger";
import { updateAttributes } from "@formbricks/lib/sdk/attributes";
import { RNAppConfig } from "@formbricks/lib/sdk/config";
import { sync } from "@formbricks/lib/sdk/sync";
import { TAttributes } from "@formbricks/types/attributes";
import { TJSAppConfig, TJsAppConfigInput } from "@formbricks/types/js";
import { trackAction } from "./actions";

const logger = Logger.getInstance();
const appConfig = RNAppConfig.getInstance();

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

    if (res.ok !== true) {
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
    existingConfig &&
    existingConfig.state &&
    existingConfig.environmentId === c.environmentId &&
    existingConfig.apiHost === c.apiHost &&
    existingConfig.userId === c.userId &&
    existingConfig.expiresAt // only accept config when they follow new config version with expiresAt
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
    await trackAction("New Session");
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

export const deinitalize = (): void => {
  logger.debug("Deinitializing");
  // closeSurvey();
  appConfig.resetConfig();
  setIsInitialize(false);
};
