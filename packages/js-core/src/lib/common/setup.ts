/* eslint-disable no-console -- required for logging */
import { Config } from "@/lib/common/config";
import { JS_LOCAL_STORAGE_KEY } from "@/lib/common/constants";
import {
  addCleanupEventListeners,
  addEventListeners,
  removeAllEventListeners,
} from "@/lib/common/event-listeners";
import { Logger } from "@/lib/common/logger";
import { filterSurveys, getIsDebug, isNowExpired, wrapThrows } from "@/lib/common/utils";
import { fetchEnvironmentState } from "@/lib/environment/state";
import { checkPageUrl } from "@/lib/survey/no-code-action";
import { addWidgetContainer, removeWidgetContainer, setIsSurveyRunning } from "@/lib/survey/widget";
import { DEFAULT_USER_STATE_NO_USER_ID } from "@/lib/user/state";
import { sendUpdatesToBackend } from "@/lib/user/update";
import {
  type TConfig,
  type TConfigInput,
  type TEnvironmentState,
  type TLegacyConfig,
  type TUserState,
} from "@/types/config";
import {
  type MissingFieldError,
  type MissingPersonError,
  type NetworkError,
  type NotSetupError,
  type Result,
  err,
  okVoid,
} from "@/types/error";

let isSetup = false;

export const setIsSetup = (state: boolean): void => {
  isSetup = state;
};

const migrateLocalStorage = (): { changed: boolean; newState?: TConfig } => {
  const existingConfig = localStorage.getItem(JS_LOCAL_STORAGE_KEY);

  if (existingConfig) {
    const parsedConfig = JSON.parse(existingConfig) as TLegacyConfig;

    // Check if we need to migrate (if it has environmentState, it's old format)
    if (parsedConfig.environmentState) {
      const { apiHost, environmentState, personState, attributes, ...rest } = parsedConfig;

      // Create new config structure
      const newLocalStorageConfig: TConfig = {
        ...rest,
        ...(apiHost && { appUrl: apiHost }),
        environment: environmentState,
        ...(personState && {
          user: {
            ...personState,
            data: {
              ...personState.data,
              // Copy over language from attributes if it exists
              ...(attributes?.language && { language: attributes.language }),
            },
          },
        }),
      };

      return {
        changed: true,
        newState: newLocalStorageConfig,
      };
    }
  }

  return { changed: false };
};

export const setup = async (
  configInput: TConfigInput | (TConfigInput & { userId: string; attributes: Record<string, string> })
): Promise<Result<void, MissingFieldError | NetworkError | MissingPersonError>> => {
  const isDebug = getIsDebug();
  const logger = Logger.getInstance();

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
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- user could be undefined
    if (newState && !newState.user?.data?.userId) {
      config.update(newState);
    }
  }

  if (isSetup) {
    logger.debug("Already set up, skipping setup.");
    return okVoid();
  }

  let existingConfig: TConfig | undefined;
  try {
    existingConfig = config.get();
    logger.debug("Found existing configuration.");
  } catch {
    logger.debug("No existing configuration found.");
  }

  // formbricks is in error state, skip setup
  if (existingConfig?.status.value === "error") {
    if (isDebug) {
      logger.debug(
        "Formbricks is in error state, but debug mode is active. Resetting config and continuing."
      );
      config.resetConfig();
      return okVoid();
    }

    console.error("🧱 Formbricks - Formbricks was set to an error state.");

    const expiresAt = existingConfig.status.expiresAt;

    if (expiresAt && isNowExpired(new Date(expiresAt))) {
      console.error("🧱 Formbricks - Error state is not expired, skipping initialization");
      return okVoid();
    }
    console.error("🧱 Formbricks - Error state is expired. Continuing with initialization.");
  }

  logger.debug("Start setup");

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

  logger.debug("Adding widget container to DOM");
  addWidgetContainer();

  if (
    existingConfig?.environment &&
    existingConfig.environmentId === configInput.environmentId &&
    existingConfig.appUrl === configInput.appUrl
  ) {
    logger.debug("Configuration fits setup parameters.");
    let isEnvironmentStateExpired = false;
    let isUserStateExpired = false;

    const environmentStateExpiresAt = new Date(existingConfig.environment.expiresAt);

    if (isNowExpired(environmentStateExpiresAt)) {
      logger.debug("Environment state expired. Syncing.");
      isEnvironmentStateExpired = true;
    }

    if (existingConfig.user.expiresAt && isNowExpired(new Date(existingConfig.user.expiresAt))) {
      logger.debug("User state expired. Syncing.");
      isUserStateExpired = true;
    }

    try {
      // fetch the environment state (if expired)
      let environmentState: TEnvironmentState = existingConfig.environment;
      let userState: TUserState = existingConfig.user;

      if (isEnvironmentStateExpired || isDebug) {
        if (isDebug) {
          logger.debug("Debug mode is active, refetching environment state");
        }

        const environmentStateResponse = await fetchEnvironmentState({
          appUrl: configInput.appUrl,
          environmentId: configInput.environmentId,
        });

        if (environmentStateResponse.ok) {
          environmentState = environmentStateResponse.data;
          const backendSurveys = environmentState.data.surveys;
          logger.debug(`Fetched ${backendSurveys.length.toString()} surveys from the backend`);
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
      }

      if (isUserStateExpired || isDebug) {
        // If the existing person state (expired) has a userId, we need to fetch the person state
        // If the existing person state (expired) has no userId, we need to set the person state to the default

        if (isDebug) {
          logger.debug("Debug mode is active, refetching user state");
        }

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
        } else if (!isDebug) {
          userState = DEFAULT_USER_STATE_NO_USER_ID;
        }
      }

      // filter the environment state wrt the person state
      const filteredSurveys = filterSurveys(environmentState, userState);
      logger.debug(`${filteredSurveys.length.toString()} surveys could be shown to current user on trigger.`);

      // update the appConfig with the new filtered surveys and person state
      config.update({
        ...existingConfig,
        environment: environmentState,
        user: userState,
        filteredSurveys,
      });

      // const surveyNames = filteredSurveys.map((s) => s.name);
      // logger.debug(`Fetched ${surveyNames.length.toString()} surveys during sync: ${surveyNames.join(", ")}`);
    } catch {
      logger.debug("Error during sync. Please try again.");
    }
  } else {
    logger.debug("No valid configuration found. Resetting config and creating new one.");
    config.resetConfig();
    logger.debug("Syncing.");

    // During setup, if we don't have a valid config, we need to fetch the environment state
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

      let userState: TUserState = DEFAULT_USER_STATE_NO_USER_ID;

      const backendSurveys = environmentStateResponse.data.data.surveys;
      logger.debug(`Fetched ${backendSurveys.length.toString()} surveys from the backend`);

      if ("userId" in configInput && configInput.userId) {
        const updatesResponse = await sendUpdatesToBackend({
          appUrl: configInput.appUrl,
          environmentId: configInput.environmentId,
          updates: {
            userId: configInput.userId,
            attributes: configInput.attributes,
          },
        });

        if (updatesResponse.ok) {
          userState = updatesResponse.data.state;
        } else {
          logger.error(
            `Error updating user state: ${updatesResponse.error.code} - ${updatesResponse.error.responseMessage ?? ""}`
          );
        }
      }

      const environmentState = environmentStateResponse.data;
      const filteredSurveys = filterSurveys(environmentState, userState);
      logger.debug(`${filteredSurveys.length.toString()} surveys could be shown to current user on trigger.`);

      config.update({
        appUrl: configInput.appUrl,
        environmentId: configInput.environmentId,
        user: userState,
        environment: environmentState,
        filteredSurveys,
      });
    } catch (e) {
      await handleErrorOnFirstSetup(e as { code: string; responseMessage: string });
    }
  }

  logger.debug("Adding event listeners");
  addEventListeners();
  addCleanupEventListeners();

  setIsSetup(true);
  logger.debug("Set up complete");

  // check page url if set up after page load
  void checkPageUrl();
  return okVoid();
};

export const checkSetup = (): Result<void, NotSetupError> => {
  const logger = Logger.getInstance();
  logger.debug("Check if set up");

  if (!isSetup) {
    return err({
      code: "not_setup",
      message: "Formbricks is not set up. Call setup() first.",
    });
  }

  return okVoid();
};

export const tearDown = (): void => {
  const logger = Logger.getInstance();
  const appConfig = Config.getInstance();

  logger.debug("Setting user state to default");
  // clear the user state and set it to the default value
  appConfig.update({
    ...appConfig.get(),
    user: DEFAULT_USER_STATE_NO_USER_ID,
  });

  removeWidgetContainer();
  setIsSurveyRunning(false);
  removeAllEventListeners();
  setIsSetup(false);
};

export const handleErrorOnFirstSetup = (e: { code: string; responseMessage: string }): Promise<never> => {
  const logger = Logger.getInstance();

  if (e.code === "forbidden") {
    logger.error(`Authorization error: ${e.responseMessage}`);
  } else {
    logger.error(`Error during first setup: ${e.code} - ${e.responseMessage}. Please try again later.`);
  }

  // put formbricks in error state (by creating a new config) and throw error
  const initialErrorConfig: Partial<TConfig> = {
    status: {
      value: "error",
      expiresAt: new Date(new Date().getTime() + 10 * 60000), // 10 minutes in the future
    },
  };

  wrapThrows(() => {
    localStorage.setItem(JS_LOCAL_STORAGE_KEY, JSON.stringify(initialErrorConfig));
  })();

  throw new Error("Could not set up formbricks");
};

export const putFormbricksInErrorState = (formbricksConfig: Config): void => {
  const logger = Logger.getInstance();

  if (getIsDebug()) {
    logger.debug("Not putting formbricks in error state because debug mode is active (no error state)");
    return;
  }

  logger.debug("Putting formbricks in error state");
  // change formbricks status to error
  formbricksConfig.update({
    ...formbricksConfig.get(),
    status: {
      value: "error",
      expiresAt: new Date(new Date().getTime() + 10 * 60000), // 10 minutes in the future
    },
  });

  tearDown();
};
