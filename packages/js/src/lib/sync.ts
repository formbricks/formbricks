import { diffInDays } from "@formbricks/lib/utils/datetime";
import { TJsState, TJsStateSync, TJsSyncParams } from "@formbricks/types/js";

import { Config } from "./config";
import { NetworkError, Result, err, ok } from "./errors";
import { Logger } from "./logger";

const config = Config.getInstance();
const logger = Logger.getInstance();

let syncIntervalId: number | null = null;

const syncWithBackend = async ({
  apiHost,
  environmentId,
  userId,
}: TJsSyncParams): Promise<Result<TJsStateSync, NetworkError>> => {
  const url = `${apiHost}/api/v1/client/${environmentId}/in-app/sync/${userId}`;
  const publicUrl = `${apiHost}/api/v1/client/${environmentId}/in-app/sync`;

  // if user id is available

  if (!userId) {
    // public survey
    const response = await fetch(publicUrl);

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

    return ok((await response.json()).data as TJsState);
  }

  // userId is available, call the api with the `userId` param

  const response = await fetch(url);

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

export const sync = async (params: TJsSyncParams): Promise<void> => {
  try {
    const syncResult = await syncWithBackend(params);
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
      surveys: syncResult.value.surveys,
      noCodeActionClasses: syncResult.value.noCodeActionClasses,
      product: syncResult.value.product,
      attributes: oldState?.attributes || {},
    };

    if (!params.userId) {
      // unidentified user
      // set the displays and filter out surveys
      state = {
        ...state,
        displays: oldState?.displays || [],
      };
      state = filterPublicSurveys(state);

      const surveyNames = state.surveys.map((s) => s.name);
      logger.debug("Fetched " + surveyNames.length + " surveys during sync: " + surveyNames.join(", "));
    } else {
      const surveyNames = state.surveys.map((s) => s.name);
      logger.debug("Fetched " + surveyNames.length + " surveys during sync: " + surveyNames.join(", "));
    }

    config.update({
      apiHost: params.apiHost,
      environmentId: params.environmentId,
      userId: params.userId,
      language: params.language,
      state,
    });

    // before finding the surveys, check for public use
  } catch (error) {
    logger.error(`Error during sync: ${error}`);
    throw error;
  }
};

export const filterPublicSurveys = (state: TJsState): TJsState => {
  const { displays, product } = state;

  let { surveys } = state;

  if (!displays) {
    return state;
  }

  // filter surveys that meet the displayOption criteria
  let filteredSurveys = surveys.filter((survey) => {
    if (survey.displayOption === "respondMultiple") {
      return true;
    } else if (survey.displayOption === "displayOnce") {
      return displays.filter((display) => display.surveyId === survey.id).length === 0;
    } else if (survey.displayOption === "displayMultiple") {
      return displays.filter((display) => display.surveyId === survey.id && display.responded).length === 0;
    } else {
      throw Error("Invalid displayOption");
    }
  });

  const latestDisplay = displays.length > 0 ? displays[displays.length - 1] : undefined;

  // filter surveys that meet the recontactDays criteria
  filteredSurveys = filteredSurveys.filter((survey) => {
    if (!latestDisplay) {
      return true;
    } else if (survey.recontactDays !== null) {
      const lastDisplaySurvey = displays.filter((display) => display.surveyId === survey.id)[0];
      if (!lastDisplaySurvey) {
        return true;
      }
      return diffInDays(new Date(), new Date(lastDisplaySurvey.createdAt)) >= survey.recontactDays;
    } else if (product.recontactDays !== null) {
      return diffInDays(new Date(), new Date(latestDisplay.createdAt)) >= product.recontactDays;
    } else {
      return true;
    }
  });

  return {
    ...state,
    surveys: filteredSurveys,
  };
};

export const addExpiryCheckListener = (): void => {
  const updateInterval = 1000 * 60; // every minute
  // add event listener to check sync with backend on regular interval
  if (typeof window !== "undefined" && syncIntervalId === null) {
    syncIntervalId = window.setInterval(async () => {
      // check if the config has not expired yet
      if (config.get().expiresAt && new Date(config.get().expiresAt) >= new Date()) {
        return;
      }
      logger.debug("Config has expired. Starting sync.");
      await sync({
        apiHost: config.get().apiHost,
        environmentId: config.get().environmentId,
        userId: config.get().userId,
        language: config.get().language,
        // personId: config.get().state?.person?.id,
      });
    }, updateInterval);
  }
};

export const removeExpiryCheckListener = (): void => {
  if (typeof window !== "undefined" && syncIntervalId !== null) {
    window.clearInterval(syncIntervalId);

    syncIntervalId = null;
  }
};
