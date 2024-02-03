import { CommandQueue } from "@formbricks/lib/commandQueue";
import {
  ErrorHandler,
  MissingFieldError,
  MissingPersonError,
  NetworkError,
  Result,
  err,
  ok,
  okVoid,
} from "@formbricks/lib/errors";
import { isInitialized, setIsInitialize } from "@formbricks/lib/initializationState";
import { Logger } from "@formbricks/lib/logger";
import { TJsConfigInput, TJsState, TJsStateSync, TJsSyncParams } from "@formbricks/types/js";

import { Config } from "./config";

export * from "./test";

const logger = Logger.getInstance();

logger.debug("Create command queue");
const queue = new CommandQueue();

const config = Config.getInstance();

// todo: create types for react-native config
export const init = async (initConfig: TJsConfigInput) => {
  ErrorHandler.init(initConfig.errorHandler);
  queue.add(false, initialize, initConfig);
  await queue.wait();
};

const setDebugLevel = (c: TJsConfigInput): void => {
  if (c.debug) {
    logger.debug(`Setting log level to debug`);
    logger.configure({ logLevel: "debug" });
  }
};

const initialize = async (
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

  // if (!c.userId) {
  //   logger.error("No userId provided.");
  //   return err({
  //     code: "missing_field",
  //     field: "userId",
  //   });
  // }
  await config.loadFromAsyncStorage();

  const syncResult = await syncWithBackend({
    apiHost: c.apiHost,
    environmentId: c.environmentId,
    userId: c.userId,
  });

  if (syncResult.ok) {
    console.log(syncResult.value);
    let state: TJsState = {
      surveys: syncResult.value.surveys,
      noCodeActionClasses: syncResult.value.noCodeActionClasses,
      product: syncResult.value.product,
      attributes: {},
    };
    config.update({
      apiHost: c.apiHost,
      environmentId: c.environmentId,
      userId: c.userId,
      state,
    });
  }

  console.log("config: ", config.get());

  // todo: update attributes
  // if userId and attributes are available, set them in backend
  //   let updatedAttributes: TPersonAttributes | null = null;
  //   if (c.userId && c.attributes) {
  //     const res = await updatePersonAttributes(c.apiHost, c.environmentId, c.userId, c.attributes);

  //     if (res.ok !== true) {
  //       return err(res.error);
  //     }
  //     updatedAttributes = res.value;
  //   }

  // let existingConfig: TJsConfig | undefined;
  // try {
  //   existingConfig = config.get();
  // } catch (e) {
  //   logger.debug("No existing configuration found.");
  // }

  // if (
  //   existingConfig &&
  //   existingConfig.state &&
  //   existingConfig.environmentId === c.environmentId &&
  //   existingConfig.apiHost === c.apiHost &&
  //   existingConfig.userId === c.userId &&
  //   existingConfig.expiresAt // only accept config when they follow new config version with expiresAt
  // ) {
  //   logger.debug("Found existing configuration.");
  //   if (existingConfig.expiresAt < new Date()) {
  //     logger.debug("Configuration expired.");

  //     await sync({
  //       apiHost: c.apiHost,
  //       environmentId: c.environmentId,
  //       userId: c.userId,
  //     });
  //   } else {
  //     logger.debug("Configuration not expired. Extending expiration.");
  //     config.update(existingConfig);
  //   }
  // } else {
  //   logger.debug("No valid configuration found or it has been expired. Creating new config.");
  //   logger.debug("Syncing.");

  //   await sync({
  //     apiHost: c.apiHost,
  //     environmentId: c.environmentId,
  //     userId: c.userId,
  //   });

  //   // and track the new session event
  //   // await trackAction("New Session");
  // }

  // todo: update attributes
  // update attributes in config
  //   if (updatedAttributes && Object.keys(updatedAttributes).length > 0) {
  //     config.update({
  //       environmentId: config.get().environmentId,
  //       apiHost: config.get().apiHost,
  //       userId: config.get().userId,
  //       state: {
  //         ...config.get().state,
  //         attributes: { ...config.get().state.attributes, ...c.attributes },
  //       },
  //     });
  //   }
  // todo: dont need?
  //   logger.debug("Adding event listeners");
  //   addEventListeners();
  //   addCleanupEventListeners();

  setIsInitialize(true);
  logger.debug("Initialized");

  // todo: dont need?
  // check page url if initialized after page load
  //   checkPageUrl();
  return okVoid();
};

const syncWithBackend = async ({
  apiHost,
  environmentId,
  userId,
}: TJsSyncParams): Promise<Result<TJsStateSync, NetworkError>> => {
  const url = `${apiHost}/api/v1/client/${environmentId}/in-app/sync/${userId}`;
  const publicUrl = `${apiHost}/api/v1/client/${environmentId}/in-app/sync`;

  // if user id is available

  if (!userId) {
    // public survey
    const response = await fetch(publicUrl);

    if (!response.ok) {
      const jsonRes = await response.json();

      return err({
        code: "network_error",
        status: response.status,
        message: "Error syncing with backend",
        url,
        responseMessage: jsonRes.message,
      });
    }

    return ok((await response.json()).data as TJsState);
  }

  // userId is available, call the api with the `userId` param

  const response = await fetch(url);

  if (!response.ok) {
    const jsonRes = await response.json();

    return err({
      code: "network_error",
      status: response.status,
      message: "Error syncing with backend",
      url,
      responseMessage: jsonRes.message,
    });
  }

  const data = await response.json();
  const { data: state } = data;

  return ok(state as TJsStateSync);
};
