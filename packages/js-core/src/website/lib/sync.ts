import { TJsEnvironmentState, TJsPersonState, TJsWebsiteSyncParams } from "@formbricks/types/js";
import { NetworkError, Result, err, ok } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { getIsDebug } from "../../shared/utils";
import { filterSurveys as filterPublicSurveys } from "../../shared/utils";
import { WebsiteConfig } from "./config";

const websiteConfig = WebsiteConfig.getInstance();
const logger = Logger.getInstance();

let syncIntervalId: number | null = null;

const syncWithBackend = async (
  { apiHost, environmentId }: TJsWebsiteSyncParams,
  noCache = false
): Promise<Result<TJsEnvironmentState["data"], NetworkError>> => {
  try {
    const url = `${apiHost}/api/v1/client/${environmentId}/sync?sdkType=website`;

    let fetchOptions: RequestInit = {};

    if (noCache || getIsDebug()) {
      fetchOptions.cache = "no-cache";
      logger.debug("No cache option set for sync");
    }

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

    return ok((await response.json()).data as TJsEnvironmentState["data"]);
  } catch (e) {
    return err(e as NetworkError);
  }
};

export const sync = async (
  params: TJsWebsiteSyncParams,
  opts: {
    noCache?: boolean;
    existingEnvironmentState?: TJsEnvironmentState;
    existingPersonState?: TJsPersonState;
  } = { noCache: false }
): Promise<void> => {
  try {
    const syncResult = await syncWithBackend(params, opts.noCache);

    if (syncResult?.ok !== true) {
      throw syncResult.error;
    }

    let state: TJsEnvironmentState = {
      expiresAt: new Date(new Date().getTime() + 30 * 60000), // 30 minutes in the future
      data: {
        ...syncResult.value,
      },
    };

    const defaultPersonState: TJsPersonState = {
      expiresAt: null,
      data: {
        userId: null,
        segments: [],
        displays: [],
        responses: [],
        attributes: {},
        lastDisplayAt: null,
      },
    };

    let personState: TJsPersonState = defaultPersonState;
    try {
      const existingPersonState = websiteConfig.get().personState;
      if (existingPersonState) {
        personState = existingPersonState;
      }
    } catch (err) {
      // ignore the error
    }

    state = filterPublicSurveys(state, personState);

    const surveyNames = state.data.surveys.map((s) => s.name);
    logger.debug("Fetched " + surveyNames.length + " surveys during sync: " + surveyNames.join(", "));

    websiteConfig.update({
      apiHost: params.apiHost,
      environmentId: params.environmentId,
      environmentState: state,
      personState,
    });
  } catch (error) {
    console.error(`Error during sync: ${error}`);
    throw error;
  }
};

export const addExpiryCheckListener = (): void => {
  const updateInterval = 1000 * 30; // every 30 seconds
  // add event listener to check sync with backend on regular interval
  if (typeof window !== "undefined" && syncIntervalId === null) {
    syncIntervalId = window.setInterval(async () => {
      try {
        // check if the config has not expired yet

        // TODO: Figure out expiration logic
        // if (websiteConfig.get().expiresAt && new Date(websiteConfig.get().expiresAt) >= new Date()) {
        //   return;
        // }

        logger.debug("Config has expired. Starting sync.");
        await sync({
          apiHost: websiteConfig.get().apiHost,
          environmentId: websiteConfig.get().environmentId,
        });
      } catch (e) {
        console.error(`Error during expiry check: ${e}`);
        logger.debug("Extending config and try again later.");
        const existingConfig = websiteConfig.get();
        websiteConfig.update(existingConfig);
      }
    }, updateInterval);
  }
};

export const removeExpiryCheckListener = (): void => {
  if (typeof window !== "undefined" && syncIntervalId !== null) {
    window.clearInterval(syncIntervalId);

    syncIntervalId = null;
  }
};
