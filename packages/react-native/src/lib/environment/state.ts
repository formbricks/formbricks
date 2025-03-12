/* eslint-disable no-console -- logging required for error logging */
import { FormbricksAPI } from "@formbricks/api";
import { RNConfig } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { filterSurveys } from "@/lib/common/utils";
import type { TConfigInput, TEnvironmentState } from "@/types/config";
import { type ApiErrorResponse, type Result, err, ok } from "@/types/error";

let environmentStateSyncIntervalId: number | null = null;

/**
 * Fetch the environment state from the backend
 * @param appUrl - The app URL
 * @param environmentId - The environment ID
 * @returns The environment state
 * @throws NetworkError
 */
export const fetchEnvironmentState = async ({
  appUrl,
  environmentId,
}: TConfigInput): Promise<Result<TEnvironmentState, ApiErrorResponse>> => {
  const url = `${appUrl}/api/v1/client/${environmentId}/environment`;
  const api = new FormbricksAPI({ appUrl, environmentId });

  try {
    const response = await api.client.environment.getState();

    if (!response.ok) {
      return err({
        code: response.error.code,
        status: response.error.status,
        message: "Error syncing with backend",
        url: new URL(url),
        responseMessage: response.error.message,
      });
    }

    return ok(response.data) as Result<TEnvironmentState, ApiErrorResponse>;
  } catch (e: unknown) {
    const errorTyped = e as ApiErrorResponse;
    return err({
      code: "network_error",
      message: errorTyped.message,
      status: 500,
      url: new URL(url),
      responseMessage: errorTyped.responseMessage ?? "Network error",
    });
  }
};

/**
 * Add a listener to check if the environment state has expired with a certain interval
 */
export const addEnvironmentStateExpiryCheckListener = (): void => {
  const appConfig = RNConfig.getInstance();
  const logger = Logger.getInstance();

  const updateInterval = 1000 * 60; // every minute

  if (environmentStateSyncIntervalId === null) {
    const intervalHandler = async (): Promise<void> => {
      const expiresAt = appConfig.get().environment.expiresAt;

      try {
        // check if the environmentState has not expired yet
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- expiresAt is checked for null
        if (expiresAt && new Date(expiresAt) >= new Date()) {
          return;
        }

        logger.debug("Environment State has expired. Starting sync.");

        const personState = appConfig.get().user;
        const environmentState = await fetchEnvironmentState({
          appUrl: appConfig.get().appUrl,
          environmentId: appConfig.get().environmentId,
        });

        if (environmentState.ok) {
          const { data: state } = environmentState;
          const filteredSurveys = filterSurveys(state, personState);

          appConfig.update({
            ...appConfig.get(),
            environment: state,
            filteredSurveys,
          });
        } else {
          // eslint-disable-next-line @typescript-eslint/only-throw-error -- error is an ApiErrorResponse
          throw environmentState.error;
        }
      } catch (e) {
        console.error(`Error during expiry check: `, e);
        logger.debug("Extending config and try again later.");
        const existingConfig = appConfig.get();
        appConfig.update({
          ...existingConfig,
          environment: {
            ...existingConfig.environment,
            expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
          },
        });
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
