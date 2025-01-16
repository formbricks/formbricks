import AsyncStorage from "@react-native-async-storage/async-storage";
import { type TJsConfig, type TJsConfigInput } from "../types/config";
import {
  type MissingFieldError,
  type MissingPersonError,
  type NetworkError,
  type NotInitializedError,
  type Result,
  err,
  okVoid,
} from "../types/errors";
import { trackAction } from "./actions";
import { RNConfig } from "./config";
import { RN_ASYNC_STORAGE_KEY } from "./constants";
import { fetchEnvironmentState } from "./environment-state";
import { addCleanupEventListeners, addEventListeners, removeAllEventListeners } from "./event-listeners";
import { Logger } from "./logger";
import { DEFAULT_PERSON_STATE_NO_USER_ID, fetchPersonState } from "./person-state";
import { filterSurveys, wrapThrowsAsync } from "./utils";

let isInitialized = false;
const appConfig = RNConfig.getInstance();
const logger = Logger.getInstance();

export const setIsInitialize = (state: boolean): void => {
  isInitialized = state;
};

export const initialize = async (
  configInput: Pick<TJsConfigInput, "environmentId" | "apiHost">
): Promise<Result<void, MissingFieldError | NetworkError | MissingPersonError>> => {
  if (isInitialized) {
    logger.debug("Already initialized, skipping initialization.");
    return okVoid();
  }

  let existingConfig: TJsConfig | undefined;
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

  if (!configInput.apiHost) {
    logger.debug("No apiHost provided");

    return err({
      code: "missing_field",
      field: "apiHost",
    });
  }

  if (
    existingConfig?.environmentState &&
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

    if (existingConfig.personState.expiresAt && new Date(existingConfig.personState.expiresAt) < new Date()) {
      logger.debug("Person state expired. Syncing.");
      isPersonStateExpired = true;
    }

    // if (
    //   configInput.userId &&
    //   // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- personState could be null
    //   (existingConfig.personState === null ||
    //     (existingConfig.personState.expiresAt && new Date(existingConfig.personState.expiresAt) < new Date()))
    // ) {
    //   logger.debug("Person state needs syncing - either null or expired");
    //   isPersonStateExpired = true;
    // }

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
        // If the existing person state (expired) has a userId, we need to fetch the person state
        // If the existing person state (expired) has no userId, we need to set the person state to the default

        if (personState.data.userId) {
          personState = await fetchPersonState({
            apiHost: configInput.apiHost,
            environmentId: configInput.environmentId,
            userId: personState.data.userId,
          });
        } else {
          personState = DEFAULT_PERSON_STATE_NO_USER_ID;
        }
      }

      // filter the environment state wrt the person state
      const filteredSurveys = filterSurveys(environmentState, personState);

      // update the appConfig with the new filtered surveys and person state
      appConfig.update({
        ...existingConfig,
        environmentState,
        personState,
        filteredSurveys,
      });

      const surveyNames = filteredSurveys.map((s) => s.name);
      logger.debug(`Fetched ${surveyNames.length.toString()} surveys during sync: ${surveyNames.join(", ")}`);
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
      const environmentState = await fetchEnvironmentState(
        {
          apiHost: configInput.apiHost,
          environmentId: configInput.environmentId,
        },
        false
      );

      // const personState = configInput.userId
      //   ? await fetchPersonState(
      //       {
      //         apiHost: configInput.apiHost,
      //         environmentId: configInput.environmentId,
      //         userId: configInput.userId,
      //       },
      //       false
      //     )
      //   : DEFAULT_PERSON_STATE_NO_USER_ID;

      const personState = DEFAULT_PERSON_STATE_NO_USER_ID;

      const filteredSurveys = filterSurveys(environmentState, personState);

      // let updatedAttributes: TAttributes | null = null;
      // if (configInput.attributes) {
      //   if (configInput.userId) {
      //     const res = await updateAttributes(
      //       configInput.apiHost,
      //       configInput.environmentId,
      //       configInput.userId,
      //       configInput.attributes
      //     );

      //     if (!res.ok) {
      //       if (res.error.code === "forbidden") {
      //         logger.error(`Authorization error: ${res.error.responseMessage ?? ""}`);
      //       }
      //       return err(res.error) as unknown as Result<
      //         void,
      //         MissingFieldError | NetworkError | MissingPersonError
      //       >;
      //     }

      //     updatedAttributes = res.value;
      //   } else {
      //     updatedAttributes = { ...configInput.attributes };
      //   }
      // }

      appConfig.update({
        apiHost: configInput.apiHost,
        environmentId: configInput.environmentId,
        personState,
        environmentState,
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
    personState: DEFAULT_PERSON_STATE_NO_USER_ID,
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
  const initialErrorConfig: Partial<TJsConfig> = {
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
