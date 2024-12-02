/* eslint-disable @typescript-eslint/no-unnecessary-condition -- required */

/* eslint-disable no-console -- required for logging */
import type { TAttributes } from "@formbricks/types/attributes";
import { type Result, err, ok } from "@formbricks/types/error-handlers";
import type { NetworkError } from "@formbricks/types/errors";
import type { TJsRNState, TJsRNStateSync, TJsRNSyncParams } from "@formbricks/types/js";
import { Logger } from "../../../js-core/src/lib/logger";
import type { RNConfig } from "./config";

const logger = Logger.getInstance();

let syncIntervalId: number | null = null;

const syncWithBackend = async (
  { apiHost, environmentId, userId }: TJsRNSyncParams,
  noCache: boolean
): Promise<Result<TJsRNStateSync, NetworkError>> => {
  try {
    const fetchOptions: RequestInit = {};

    if (noCache) {
      fetchOptions.cache = "no-cache";
      logger.debug("No cache option set for sync");
    }
    logger.debug("syncing with backend");
    const url = `${apiHost}/api/v1/client/${environmentId}/app/sync/${userId}`;

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const jsonRes = (await response.json()) as { message: string };

      return err({
        code: "network_error",
        status: response.status,
        message: "Error syncing with backend",
        url,
        responseMessage: jsonRes.message,
      }) as Result<TJsRNStateSync, NetworkError>;
    }

    const data = (await response.json()) as { data: TJsRNStateSync };
    const { data: state } = data;

    return ok(state);
  } catch (e) {
    return err(e as NetworkError);
  }
};

export const sync = async (params: TJsRNSyncParams, appConfig: RNConfig, noCache = false): Promise<void> => {
  try {
    const syncResult = await syncWithBackend(params, noCache);

    if (!syncResult.ok) {
      throw syncResult.error as unknown as Error;
    }

    const attributes: TAttributes = params.attributes ?? {};

    if (syncResult.data.language) {
      attributes.language = syncResult.data.language;
    }

    const state: TJsRNState = {
      surveys: syncResult.data.surveys,
      actionClasses: syncResult.data.actionClasses,
      product: syncResult.data.product,
      attributes,
    };

    const surveyNames = state.surveys.map((s) => s.name);
    logger.debug(`Fetched ${surveyNames.length.toString()} surveys during sync: ${surveyNames.join(", ")}`);

    appConfig.update({
      apiHost: params.apiHost,
      environmentId: params.environmentId,
      userId: params.userId,
      state,
      expiresAt: new Date(new Date().getTime() + 2 * 60000), // 2 minutes in the future
    });
  } catch (error) {
    console.error(`Error during sync: ${error as string}`);
    throw error;
  }
};

export const addExpiryCheckListener = (appConfig: RNConfig): void => {
  const updateInterval = 1000 * 30; // every 30 seconds
  // add event listener to check sync with backend on regular interval
  if (typeof window !== "undefined" && syncIntervalId === null) {
    syncIntervalId = window.setInterval(
      // eslint-disable-next-line @typescript-eslint/no-misused-promises -- we want to run this function async
      async () => {
        try {
          // check if the config has not expired yet
          if (appConfig.get().expiresAt && new Date(appConfig.get().expiresAt) >= new Date()) {
            return;
          }
          logger.debug("Config has expired. Starting sync.");
          await sync(
            {
              apiHost: appConfig.get().apiHost,
              environmentId: appConfig.get().environmentId,
              userId: appConfig.get().userId,
              attributes: appConfig.get().state.attributes,
            },
            appConfig
          );
        } catch (e) {
          console.error(`Error during expiry check: ${e as string}`);
          logger.debug("Extending config and try again later.");
          const existingConfig = appConfig.get();
          appConfig.update(existingConfig);
        }
      },
      updateInterval
    );
  }
};

export const removeExpiryCheckListener = (): void => {
  if (typeof window !== "undefined" && syncIntervalId !== null) {
    window.clearInterval(syncIntervalId);

    syncIntervalId = null;
  }
};
