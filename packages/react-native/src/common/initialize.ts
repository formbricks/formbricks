import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchEnvironmentState } from "../environment/environment-state";
import { trackAction } from "../survey/action";
import { type TConfig, type TConfigInput, type TEnvironmentState } from "../types/config";
import {
  type MissingFieldError,
  type MissingPersonError,
  type NetworkError,
  type NotInitializedError,
  type Result,
  err,
  okVoid,
} from "../types/error";
import { DEFAULT_USER_STATE_NO_USER_ID } from "../user/user-state";
import { sendUpdatesToBackend } from "../user/user-update";
import { RNConfig } from "./config";
import { RN_ASYNC_STORAGE_KEY } from "./constants";
import { addCleanupEventListeners, addEventListeners, removeAllEventListeners } from "./event-listeners";
import { Logger } from "./logger";
import { filterSurveys, wrapThrowsAsync } from "./utils";

let isInitialized = false;
const appConfig = RNConfig.getInstance();
const logger = Logger.getInstance();

export const setIsInitialize = (state: boolean): void => {
  isInitialized = state;
};

export const init = async (
  configInput: TConfigInput
): Promise<Result<void, MissingFieldError | NetworkError | MissingPersonError>> => {
  if (isInitialized) {
    logger.debug("Already initialized, skipping initialization.");
    return okVoid();
  }

  let existingConfig: TConfig | undefined;
  try {
    existingConfig = appConfig.get();
    logger.debug("Found existing configuration.");
  } catch {
    logger.debug("No existing configuration found.");
  }

  // formbricks is in error state, skip initialization
  if (existingConfig?.status.value === "error") {
    logger.debug("Formbricks was set to an error state.");

    const expiresAt = existingConfig.status.expiresAt;

    if (expiresAt && new Date(expiresAt) > new Date()) {
      logger.debug("Error state is not expired, skipping initialization");
      return okVoid();
    }
    logger.debug("Error state is expired. Continue with initialization.");
  }

  logger.debug("Start initialize");

  if (!configInput.environmentId) {
    logger.debug("No environmentId provided");
    return err({
      code: "missing_field",
      field: "environmentId",
    });
  }

  if (!configInput.appUrl) {
    logger.debug("No appUrl provided");

    return err({
      code: "missing_field",
      field: "appUrl",
    });
  }

  if (
    existingConfig?.environment &&
    existingConfig.environmentId === configInput.environmentId &&
    existingConfig.appUrl === configInput.appUrl
  ) {
    logger.debug("Configuration fits init parameters.");
    let isEnvironmentStateExpired = false;
    let isUserStateExpired = false;

    if (new Date(existingConfig.environment.expiresAt) < new Date()) {
      logger.debug("Environment state expired. Syncing.");
      isEnvironmentStateExpired = true;
    }

    if (existingConfig.user.expiresAt && new Date(existingConfig.user.expiresAt) < new Date()) {
      logger.debug("Person state expired. Syncing.");
      isUserStateExpired = true;
    }

    try {
      // fetch the environment state (if expired)
      let environmentState: TEnvironmentState;

      if (isEnvironmentStateExpired) {
        const environmentStateResponse = await fetchEnvironmentState({
          appUrl: configInput.appUrl,
          environmentId: configInput.environmentId,
        });

        if (environmentStateResponse.ok) {
          environmentState = environmentStateResponse.data;
        } else {
          logger.error(
            `Error fetching environment state: ${environmentStateResponse.error.code} - ${environmentStateResponse.error.responseMessage ?? ""}`
          );
          return err({
            code: "network_error",
            message: "Error fetching environment state",
            status: 500,
            url: new URL(`${configInput.appUrl}/api/v1/client/${configInput.environmentId}/environment`),
            responseMessage: environmentStateResponse.error.message,
          });
        }

        // fetch the person state (if expired)
        let { user: userState } = existingConfig;

        if (isUserStateExpired) {
          // If the existing person state (expired) has a userId, we need to fetch the person state
          // If the existing person state (expired) has no userId, we need to set the person state to the default

          if (userState.data.userId) {
            const updatesResponse = await sendUpdatesToBackend({
              appUrl: configInput.appUrl,
              environmentId: configInput.environmentId,
              updates: {
                userId: userState.data.userId,
              },
            });

            if (updatesResponse.ok) {
              userState = updatesResponse.data.state;
            } else {
              logger.error(
                `Error updating user state: ${updatesResponse.error.code} - ${updatesResponse.error.responseMessage ?? ""}`
              );
              return err({
                code: "network_error",
                message: "Error updating user state",
                status: 500,
                url: new URL(
                  `${configInput.appUrl}/api/v1/client/${configInput.environmentId}/update/contacts/${userState.data.userId}`
                ),
                responseMessage: "Unknown error",
              });
            }
          } else {
            userState = DEFAULT_USER_STATE_NO_USER_ID;
          }
        }

        // filter the environment state wrt the person state
        const filteredSurveys = filterSurveys(environmentState, userState);

        // update the appConfig with the new filtered surveys and person state
        appConfig.update({
          ...existingConfig,
          environment: environmentState,
          user: userState,
          filteredSurveys,
        });

        const surveyNames = filteredSurveys.map((s) => s.name);
        logger.debug(
          `Fetched ${surveyNames.length.toString()} surveys during sync: ${surveyNames.join(", ")}`
        );
      }
    } catch {
      logger.debug("Error during sync. Please try again.");
    }
  } else {
    logger.debug("No valid configuration found. Resetting config and creating new one.");
    void appConfig.resetConfig();
    logger.debug("Syncing.");

    // During init, if we don't have a valid config, we need to fetch the environment state
    // but not the person state, we can set it to the default value.
    // The person state will be fetched when the `setUserId` method is called.

    try {
      const environmentStateResponse = await fetchEnvironmentState({
        appUrl: configInput.appUrl,
        environmentId: configInput.environmentId,
      });

      if (!environmentStateResponse.ok) {
        // eslint-disable-next-line @typescript-eslint/only-throw-error -- error is ApiErrorResponse
        throw environmentStateResponse.error;
      }

      const personState = DEFAULT_USER_STATE_NO_USER_ID;
      const environmentState = environmentStateResponse.data;

      const filteredSurveys = filterSurveys(environmentState, personState);

      appConfig.update({
        appUrl: configInput.appUrl,
        environmentId: configInput.environmentId,
        user: personState,
        environment: environmentState,
        filteredSurveys,
        attributes: {},
      });
    } catch (e) {
      await handleErrorOnFirstInit(e as { code: string; responseMessage: string });
    }

    // and track the new session event
    trackAction("New Session");
  }

  logger.debug("Adding event listeners");
  addEventListeners();
  addCleanupEventListeners();

  setIsInitialize(true);
  logger.debug("Initialized");

  // check page url if initialized after page load
  return okVoid();
};

export const checkInitialized = (): Result<void, NotInitializedError> => {
  logger.debug("Check if initialized");

  if (!isInitialized) {
    return err({
      code: "not_initialized",
      message: "Formbricks not initialized. Call initialize() first.",
    });
  }

  return okVoid();
};

// eslint-disable-next-line @typescript-eslint/require-await -- disabled for now
export const deinitalize = async (): Promise<void> => {
  logger.debug("Setting person state to default");
  // await appConfig.resetConfig();
  // clear the user state and set it to the default value
  appConfig.update({
    ...appConfig.get(),
    user: DEFAULT_USER_STATE_NO_USER_ID,
  });
  setIsInitialize(false);
  removeAllEventListeners();
};

export const handleErrorOnFirstInit = async (e: {
  code: string;
  responseMessage: string;
}): Promise<never> => {
  if (e.code === "forbidden") {
    logger.error(`Authorization error: ${e.responseMessage}`);
  } else {
    logger.error(
      `Error during first initialization: ${e.code} - ${e.responseMessage}. Please try again later.`
    );
  }

  // put formbricks in error state (by creating a new config) and throw error
  const initialErrorConfig: Partial<TConfig> = {
    status: {
      value: "error",
      expiresAt: new Date(new Date().getTime() + 10 * 60000), // 10 minutes in the future
    },
  };

  await wrapThrowsAsync(async () => {
    await AsyncStorage.setItem(RN_ASYNC_STORAGE_KEY, JSON.stringify(initialErrorConfig));
  })();

  throw new Error("Could not initialize formbricks");
};
