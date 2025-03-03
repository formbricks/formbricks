// shared functions for environment and person state(s)
import { type ApiErrorResponse } from "@formbricks/types/errors";
import { type TJsEnvironmentState, type TJsEnvironmentSyncParams } from "@formbricks/types/js";
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
  noCache = false
): Promise<TJsEnvironmentState> => {
  const fetchOptions: RequestInit = {};

  if (noCache || getIsDebug()) {
    fetchOptions.cache = "no-cache";
    logger.debug("No cache option set for sync");
  }

  const url = `${apiHost}/api/v1/client/${environmentId}/environment`;

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const jsonRes = (await response.json()) as { message: string };

    const error = err<ApiErrorResponse>({
      code: "network_error",
      status: response.status,
      message: "Error syncing with backend",
      url: new URL(url),
      responseMessage: jsonRes.message,
    });

    // eslint-disable-next-line @typescript-eslint/only-throw-error -- error.error
    throw error.error;
  }

  const data = (await response.json()) as { data: TJsEnvironmentState };
  const { data: state } = data;

  return state;
};

/**
 * Add a listener to check if the environment state has expired with a certain interval
 */
export const addEnvironmentStateExpiryCheckListener = (): void => {
  const updateInterval = 1000 * 60; // every minute
  if (typeof window !== "undefined" && environmentStateSyncIntervalId === null) {
    const intervalHandler = async (): Promise<void> => {
      const expiresAt = config.get().environmentState.expiresAt;

      try {
        // check if the environmentState has not expired yet
        if (new Date(expiresAt) >= new Date()) {
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
      } catch (e: unknown) {
        logger.error(`Error during expiry check: ${e as string}`);
        logger.debug("Extending config and try again later.");
        const existingConfig = config.get();
        config.update(existingConfig);
      }
    };

    environmentStateSyncIntervalId = window.setInterval(() => void intervalHandler(), updateInterval);
  }
};

export const clearEnvironmentStateExpiryCheckListener = (): void => {
  if (environmentStateSyncIntervalId) {
    clearInterval(environmentStateSyncIntervalId);
    environmentStateSyncIntervalId = null;
  }
};
