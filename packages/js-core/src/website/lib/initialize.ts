import type { TJsConfig, TJsWebsiteConfigInput } from "@formbricks/types/js";
import { fetchEnvironmentState } from "../../shared/environmentState";
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
} from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { DEFAULT_PERSON_STATE_WEBSITE } from "../../shared/personState";
import { getIsDebug } from "../../shared/utils";
import { filterSurveys as filterPublicSurveys } from "../../shared/utils";
import { trackNoCodeAction } from "./actions";
import { WEBSITE_LOCAL_STORAGE_KEY, WebsiteConfig } from "./config";
import { addCleanupEventListeners, addEventListeners, removeAllEventListeners } from "./eventListeners";
import { checkPageUrl } from "./noCodeActions";
import { addWidgetContainer, removeWidgetContainer, setIsSurveyRunning } from "./widget";

const websiteConfig = WebsiteConfig.getInstance();
const logger = Logger.getInstance();

let isInitialized = false;

export const setIsInitialized = (value: boolean) => {
  isInitialized = value;
};

export const initialize = async (
  configInput: TJsWebsiteConfigInput
): Promise<Result<void, MissingFieldError | NetworkError | MissingPersonError>> => {
  const isDebug = getIsDebug();
  if (isDebug) {
    logger.configure({ logLevel: "debug" });
  }

  if (isInitialized) {
    logger.debug("Already initialized, skipping initialization.");
    return okVoid();
  }

  let existingConfig: TJsConfig | undefined;
  try {
    existingConfig = websiteConfig.get();
    logger.debug("Found existing configuration.");
  } catch (e) {
    logger.debug("No existing configuration found.");
  }

  // formbricks is in error state, skip initialization
  if (existingConfig?.status?.value === "error") {
    if (isDebug) {
      logger.debug(
        "Formbricks is in error state, but debug mode is active. Resetting config and continuing."
      );
      websiteConfig.resetConfig();
      return okVoid();
    }

    logger.debug("Formbricks was set to an error state.");

    if (existingConfig?.status?.expiresAt && new Date(existingConfig?.status?.expiresAt) > new Date()) {
      logger.debug("Error state is not expired, skipping initialization");
      return okVoid();
    } else {
      logger.debug("Error state is expired. Continue with initialization.");
    }
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

  logger.debug("Adding widget container to DOM");
  addWidgetContainer();

  if (
    existingConfig &&
    existingConfig.environmentId === configInput.environmentId &&
    existingConfig.apiHost === configInput.apiHost &&
    existingConfig.environmentState
  ) {
    logger.debug("Configuration fits init parameters.");
    if (existingConfig.environmentState.expiresAt < new Date()) {
      logger.debug("Configuration expired.");

      try {
        // fetch the environment state

        const environmentState = await fetchEnvironmentState(
          {
            apiHost: configInput.apiHost,
            environmentId: configInput.environmentId,
          },
          "website"
        );

        // filter the surveys with the default person state

        const filteredSurveys = filterPublicSurveys(environmentState, DEFAULT_PERSON_STATE_WEBSITE);

        websiteConfig.update({
          apiHost: configInput.apiHost,
          environmentId: configInput.environmentId,
          environmentState,
          personState: DEFAULT_PERSON_STATE_WEBSITE,
          filteredSurveys,
        });
      } catch (e) {
        putFormbricksInErrorState();
      }
    } else {
      logger.debug("Configuration not expired. Extending expiration.");
      websiteConfig.update(existingConfig);
    }
  } else {
    logger.debug(
      "No valid configuration found or it has been expired. Resetting config and creating new one."
    );
    websiteConfig.resetConfig();
    logger.debug("Syncing.");

    try {
      const environmentState = await fetchEnvironmentState(
        {
          apiHost: configInput.apiHost,
          environmentId: configInput.environmentId,
        },
        "website"
      );

      const filteredSurveys = filterPublicSurveys(environmentState, DEFAULT_PERSON_STATE_WEBSITE);

      websiteConfig.update({
        apiHost: configInput.apiHost,
        environmentId: configInput.environmentId,
        environmentState,
        personState: DEFAULT_PERSON_STATE_WEBSITE,
        filteredSurveys,
      });
    } catch (e) {
      handleErrorOnFirstInit();
    }

    if (configInput.attributes) {
      const currentWebsiteConfig = websiteConfig.get();

      websiteConfig.update({
        ...currentWebsiteConfig,
        personState: {
          ...currentWebsiteConfig.personState,
          data: {
            ...currentWebsiteConfig.personState.data,
            attributes: { ...currentWebsiteConfig.personState.data.attributes, ...configInput.attributes },
          },
        },
      });
    }

    // and track the new session event
    await trackNoCodeAction("New Session");
  }

  logger.debug("Adding event listeners");
  addEventListeners(websiteConfig);
  addCleanupEventListeners();

  setIsInitialized(true);
  logger.debug("Initialized");

  // check page url if initialized after page load

  checkPageUrl();
  return okVoid();
};

export const handleErrorOnFirstInit = () => {
  if (getIsDebug()) {
    logger.debug("Not putting formbricks in error state because debug mode is active (no error state)");
    return;
  }

  const initialErrorConfig: Partial<TJsConfig> = {
    status: {
      value: "error",
      expiresAt: new Date(new Date().getTime() + 10 * 60000), // 10 minutes in the future
    },
  };

  // can't use config.update here because the config is not yet initialized
  wrapThrows(() => localStorage.setItem(WEBSITE_LOCAL_STORAGE_KEY, JSON.stringify(initialErrorConfig)))();
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
  if (getIsDebug()) {
    logger.debug("Not putting formbricks in error state because debug mode is active (no error state)");
    return;
  }

  logger.debug("Putting formbricks in error state");
  // change formbricks status to error
  websiteConfig.update({
    ...websiteConfig.get(),
    status: {
      value: "error",
      expiresAt: new Date(new Date().getTime() + 10 * 60000), // 10 minutes in the future
    },
  });
  deinitalize();
};
