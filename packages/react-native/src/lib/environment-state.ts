/* eslint-disable no-console -- logging required for error logging */
// shared functions for environment and person state(s)
import { type TJsEnvironmentState, type TJsEnvironmentSyncParams } from "@formbricks/types/js";
import { err } from "../../../js-core/src/lib/errors";
import { Logger } from "../../../js-core/src/lib/logger";
import { filterSurveys } from "../../../js-core/src/lib/utils";
import { RNConfig } from "./config";

const appConfig = RNConfig.getInstance();
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
  const url = `${apiHost}/api/v1/client/${environmentId}/environment`;

  try {
    const fetchOptions: RequestInit = {};

    if (noCache) {
      fetchOptions.cache = "no-cache";
      logger.debug("No cache option set for sync");
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const jsonRes = (await response.json()) as { message: string };

      const error = err({
        code: "network_error",
        status: response.status,
        message: "Error syncing with backend",
        url: new URL(url),
        responseMessage: jsonRes.message,
      });

      // eslint-disable-next-line @typescript-eslint/only-throw-error -- error.error is an Error object
      throw error.error;
    }

    const data = (await response.json()) as { data: TJsEnvironmentState["data"] };
    const { data: state } = data;

    return {
      data: { ...state },
      expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
    };
  } catch (e: unknown) {
    const errorTyped = e as { message?: string };

    const error = err({
      code: "network_error",
      message: errorTyped.message ?? "Error fetching the environment state",
      status: 500,
      url: new URL(url),
      responseMessage: errorTyped.message ?? "Unknown error",
    });

    // eslint-disable-next-line @typescript-eslint/only-throw-error -- error.error is an Error object
    throw error.error;
  }
};

/**
 * Add a listener to check if the environment state has expired with a certain interval
 */
export const addEnvironmentStateExpiryCheckListener = (): void => {
  const updateInterval = 1000 * 60; // every minute

  if (environmentStateSyncIntervalId === null) {
    const intervalHandler = async (): Promise<void> => {
      const expiresAt = appConfig.get().environmentState.expiresAt;

      try {
        // check if the environmentState has not expired yet
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- expiresAt is checked for null
        if (expiresAt && new Date(expiresAt) >= new Date()) {
          return;
        }

        logger.debug("Environment State has expired. Starting sync.");

        const personState = appConfig.get().personState;
        const environmentState = await fetchEnvironmentState(
          {
            apiHost: appConfig.get().apiHost,
            environmentId: appConfig.get().environmentId,
          },
          true
        );

        const filteredSurveys = filterSurveys(environmentState, personState);

        appConfig.update({
          ...appConfig.get(),
          environmentState,
          filteredSurveys,
        });
      } catch (e) {
        console.error(`Error during expiry check: ${e as string}`);
        logger.debug("Extending config and try again later.");
        const existingConfig = appConfig.get();
        appConfig.update(existingConfig);
      }
    };

    environmentStateSyncIntervalId = setInterval(
      () => void intervalHandler(),
      updateInterval
    ) as unknown as number;
  }
};

export const clearEnvironmentStateExpiryCheckListener = (): void => {
  if (environmentStateSyncIntervalId) {
    clearInterval(environmentStateSyncIntervalId);
    environmentStateSyncIntervalId = null;
  }
};
