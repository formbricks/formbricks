// shared functions for environment and person state(s)
import { TJsEnvironmentState, TJsEnvironmentSyncParams } from "@formbricks/types/js";
import { Config } from "./config";
import { err } from "./errors";
import { Logger } from "./logger";
import { filterSurveys, getIsDebug } from "./utils";

const config = Config.getInstance();
const logger = Logger.getInstance();
let environmentStateSyncIntervalId: number | null = null;

/**
 * Fetch the environment state from the backend
 * @param apiHost - The API host
 * @param environmentId - The environment ID
 * @param noCache - Whether to skip the cache
 * @returns The environment state
 * @throws NetworkError
 */
export const fetchEnvironmentState = async (
  { apiHost, environmentId }: TJsEnvironmentSyncParams,
  noCache: boolean = false
): Promise<TJsEnvironmentState> => {
  let fetchOptions: RequestInit = {};

  if (noCache || getIsDebug()) {
    fetchOptions.cache = "no-cache";
    logger.debug("No cache option set for sync");
  }

  const url = `${apiHost}/api/v1/client/${environmentId}/environment`;

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const jsonRes = await response.json();

    const error = err({
      code: "network_error",
      status: response.status,
      message: "Error syncing with backend",
      url: new URL(url),
      responseMessage: jsonRes.message,
    });

    throw error;
  }

  const data = await response.json();
  const { data: state } = data;

  return {
    data: { ...(state as TJsEnvironmentState["data"]) },
    expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
  };
};

/**
 * Add a listener to check if the environment state has expired with a certain interval
 */
export const addEnvironmentStateExpiryCheckListener = (): void => {
  let updateInterval = 1000 * 60; // every minute
  if (typeof window !== "undefined" && environmentStateSyncIntervalId === null) {
    environmentStateSyncIntervalId = window.setInterval(async () => {
      const expiresAt = config.get().environmentState.expiresAt;

      try {
        // check if the environmentState has not expired yet
        if (expiresAt && new Date(expiresAt) >= new Date()) {
          return;
        }

        logger.debug("Environment State has expired. Starting sync.");

        const personState = config.get().personState;
        const environmentState = await fetchEnvironmentState(
          {
            apiHost: config.get().apiHost,
            environmentId: config.get().environmentId,
          },
          true
        );

        const filteredSurveys = filterSurveys(environmentState, personState);

        config.update({
          ...config.get(),
          environmentState,
          filteredSurveys,
        });
      } catch (e) {
        console.error(`Error during expiry check: ${e}`);
        logger.debug("Extending config and try again later.");
        const existingConfig = config.get();
        config.update(existingConfig);
      }
    }, updateInterval);
  }
};

export const clearEnvironmentStateExpiryCheckListener = (): void => {
  if (environmentStateSyncIntervalId) {
    clearInterval(environmentStateSyncIntervalId);
    environmentStateSyncIntervalId = null;
  }
};
