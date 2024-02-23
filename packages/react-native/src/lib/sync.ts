import type { NetworkError, Result } from "@formbricks/lib/errors";
import { err, ok } from "@formbricks/lib/errors";
import { Logger } from "@formbricks/lib/logger";
import type { TJsState, TJsStateSync, TJsSyncParams } from "@formbricks/types/js";
import type { TRNSyncParams } from "@formbricks/types/react-native";

import { Config } from "./config";

const config = Config.getInstance();
const logger = Logger.getInstance();

export const sync = async (params: TRNSyncParams, noCache = false): Promise<void> => {
  try {
    const syncResult = await syncWithBackend(params, noCache);
    if (syncResult?.ok !== true) {
      logger.error(`Sync failed: ${JSON.stringify(syncResult.error)}`);
      throw syncResult.error;
    }

    let oldState: TJsState | undefined;
    try {
      oldState = config.get().state;
    } catch (e) {
      // ignore error
    }

    let state: TJsState = {
      // filter for mobile surveys only
      surveys: syncResult.value.surveys.filter((survey) => survey.type === "mobile"),
      product: syncResult.value.product,
      noCodeActionClasses: [],
      attributes: oldState?.attributes || {},
    };

    const surveyNames = state.surveys.map((s) => s.name);
    logger.debug("Fetched " + surveyNames.length + " surveys during sync: " + surveyNames.join(", "));

    config.update({
      apiHost: params.apiHost,
      environmentId: params.environmentId,
      userId: params.userId,
      state,
    });

    // before finding the surveys, check for public use
  } catch (error) {
    logger.error(`Error during sync: ${error}`);
    throw error;
  }
};
const syncWithBackend = async (
  { apiHost, environmentId, userId }: TJsSyncParams,
  noCache: boolean
): Promise<Result<TJsStateSync, NetworkError>> => {
  const baseUrl = `${apiHost}/api/v1/client/${environmentId}/in-app/sync`;

  let fetchOptions: RequestInit = {};

  if (noCache) {
    fetchOptions.cache = "no-cache";
    logger.debug("No cache option set for sync");
  }
  // userId is available, call the api with the `userId` param
  const url = `${baseUrl}/${userId}`;

  const response = await fetch(url, fetchOptions);

  if (!response.ok) {
    const jsonRes = await response.json();

    return err({
      code: "network_error",
      status: response.status,
      message: "Error syncing with backend",
      url,
      responseMessage: jsonRes.message,
    });
  }

  const data = await response.json();
  const { data: state } = data;

  return ok(state as TJsStateSync);
};
