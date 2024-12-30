import AsyncStorage from "@react-native-async-storage/async-storage";
import { type TAttributes } from "@formbricks/types/attributes";
import { wrapThrowsAsync } from "@formbricks/types/error-handlers";
import { type TJsConfig, type TJsConfigInput } from "@formbricks/types/js";
import { RN_ASYNC_STORAGE_KEY } from "../../../js-core/src/lib/constants";
import {
  ErrorHandler,
  type MissingFieldError,
  type MissingPersonError,
  type NetworkError,
  type NotInitializedError,
  type Result,
  err,
  okVoid,
} from "../../../js-core/src/lib/errors";
import { Logger } from "../../../js-core/src/lib/logger";
import { filterSurveys } from "../../../js-core/src/lib/utils";
import { trackAction } from "./actions";
import { updateAttributes } from "./attributes";
import { RNConfig } from "./config";
import { fetchEnvironmentState } from "./environment-state";
import { addCleanupEventListeners, addEventListeners, removeAllEventListeners } from "./event-listeners";
import { DEFAULT_PERSON_STATE_NO_USER_ID, fetchPersonState } from "./person-state";

let isInitialized = false;
const appConfig = RNConfig.getInstance();
const logger = Logger.getInstance();

export const setIsInitialize = (state: boolean): void => {
  isInitialized = state;
};

export const initialize = async (
  configInput: TJsConfigInput
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

    if (
      configInput.userId &&
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- personState could be null
      (existingConfig.personState === null ||
        (existingConfig.personState.expiresAt && new Date(existingConfig.personState.expiresAt) < new Date()))
    ) {
      logger.debug("Person state needs syncing - either null or expired");
      isPersonStateExpired = true;
    }

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
        if (configInput.userId) {
          personState = await fetchPersonState({
            apiHost: configInput.apiHost,
            environmentId: configInput.environmentId,
            userId: configInput.userId,
          });
        } else {
          personState = DEFAULT_PERSON_STATE_NO_USER_ID;
        }
      }

      // filter the environment state wrt the person state
      const filteredSurveys = filterSurveys(environmentState, personState);

      // update the appConfig with the new filtered surveys
      appConfig.update({
        ...existingConfig,
        environmentState,
        personState,
        filteredSurveys,
        attributes: configInput.attributes ?? {},
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

    try {
      const environmentState = await fetchEnvironmentState(
        {
          apiHost: configInput.apiHost,
          environmentId: configInput.environmentId,
        },
        false
      );

      const personState = configInput.userId
        ? await fetchPersonState(
            {
              apiHost: configInput.apiHost,
              environmentId: configInput.environmentId,
              userId: configInput.userId,
            },
            false
          )
        : DEFAULT_PERSON_STATE_NO_USER_ID;

      const filteredSurveys = filterSurveys(environmentState, personState);

      let updatedAttributes: TAttributes | null = null;
      if (configInput.attributes) {
        if (configInput.userId) {
          const res = await updateAttributes(
            configInput.apiHost,
            configInput.environmentId,
            configInput.userId,
            configInput.attributes
          );

          if (!res.ok) {
            if (res.error.code === "forbidden") {
              logger.error(`Authorization error: ${res.error.responseMessage ?? ""}`);
            }
            return err(res.error) as unknown as Result<
              void,
              MissingFieldError | NetworkError | MissingPersonError
            >;
          }

          updatedAttributes = res.value;
        } else {
          updatedAttributes = { ...configInput.attributes };
        }
      }

      appConfig.update({
        apiHost: configInput.apiHost,
        environmentId: configInput.environmentId,
        personState,
        environmentState,
        filteredSurveys,
        attributes: updatedAttributes ?? {},
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
  await appConfig.resetConfig();
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
