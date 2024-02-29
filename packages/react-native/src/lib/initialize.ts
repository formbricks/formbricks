import { ErrorHandler, err, okVoid } from "@formbricks/lib/errors";
import type { MissingFieldError, MissingPersonError, NetworkError, Result } from "@formbricks/lib/errors";
import { isInitialized, setIsInitialize } from "@formbricks/lib/initializationState";
import { Logger } from "@formbricks/lib/logger";
import { TPersonAttributes } from "@formbricks/types/people";
import type { TRNConfig, TRNConfigInput } from "@formbricks/types/react-native";

import { Config } from "./config";
import { updatePersonAttributes } from "./person";
import { sync } from "./sync";

const logger = Logger.getInstance();
const config = Config.getInstance();

const setDebugLevel = (c: TRNConfigInput): void => {
  if (c.debug) {
    logger.debug(`Setting log level to debug`);
    logger.configure({ logLevel: "debug" });
  }
};

export const initialize = async (
  c: TRNConfigInput
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

  // todo: update attributes
  // if userId and attributes are available, set them in backend
  let updatedAttributes: TPersonAttributes | null = null;
  if (c.attributes) {
    const res = await updatePersonAttributes(c.apiHost, c.environmentId, c.userId, c.attributes);

    if (res.ok !== true) {
      return err(res.error);
    }
    updatedAttributes = res.value;
  }

  let existingConfig: TRNConfig | undefined;
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
        true
      );
    } else {
      logger.debug("Configuration not expired. Extending expiration.");
      config.update(existingConfig);
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
      true
    );

    // and track the new session event
    // await trackAction("New Session");
  }

  // todo: update attributes
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
    });
  }

  setIsInitialize(true);
  logger.debug("Initialized");

  return okVoid();
};

export const deinitalize = (): void => {
  logger.debug("Deinitializing");
  // closeSurvey();
  config.resetConfig();
  setIsInitialize(false);
};
