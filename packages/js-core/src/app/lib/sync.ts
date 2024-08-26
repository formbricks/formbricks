import {
  TJsEnvironmentState,
  TJsEnvironmentSyncParams,
  TJsPersonState,
  TJsPersonSyncParams,
} from "@formbricks/types/js";
import { NetworkError, Result, err, ok } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { filterSurveys, getIsDebug } from "../../shared/utils";
import { AppConfig } from "./config";

const appConfig = AppConfig.getInstance();
const logger = Logger.getInstance();

let personStateSyncIntervalId: number | null = null;
let environmentStateSyncIntervalId: number | null = null;

const syncWithBackend = async (
  { apiHost, environmentId }: TJsEnvironmentSyncParams,
  noCache: boolean
): Promise<Result<TJsEnvironmentState["data"], NetworkError>> => {
  try {
    let fetchOptions: RequestInit = {};

    if (noCache || getIsDebug()) {
      fetchOptions.cache = "no-cache";
      logger.debug("No cache option set for sync");
    }

    const url = `${apiHost}/api/v1/client/${environmentId}/sync?sdkType=app`;

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

    return ok(state as TJsEnvironmentState["data"]);
  } catch (e) {
    return err(e as NetworkError);
  }
};

const syncPersonWithBackend = async (
  { apiHost, environmentId, userId }: TJsPersonSyncParams,
  noCache: boolean
): Promise<Result<TJsPersonState, NetworkError>> => {
  try {
    let fetchOptions: RequestInit = {};

    if (noCache || getIsDebug()) {
      fetchOptions.cache = "no-cache";
      logger.debug("No cache option set for sync");
    }

    const url = `${apiHost}/api/v1/client/${environmentId}/app/people/${userId}`;

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

    return ok(state as TJsPersonState);
  } catch (e) {
    return err(e as NetworkError);
  }
};

export const syncEnvironmentState = async (
  params: TJsEnvironmentSyncParams,
  noCache = false
): Promise<TJsEnvironmentState> => {
  try {
    const syncResult = await syncWithBackend(params, noCache);

    if (syncResult?.ok !== true) {
      throw syncResult.error;
    }

    return {
      data: { ...syncResult.value },
      expiresAt: new Date(new Date().getTime() + 30 * 60000), // 30 minutes in the future
    };
  } catch (error) {
    console.error(`Error during sync: ${error}`);
    throw error;
  }
};

export const syncPersonState = async (
  params: TJsPersonSyncParams,
  noCache = false
): Promise<TJsPersonState | null> => {
  try {
    const syncResult = await syncPersonWithBackend(params, noCache);

    if (syncResult?.ok !== true) {
      throw syncResult.error;
    }

    if (!Object.keys(syncResult.value).length) {
      return null;
    } else {
      return {
        expiresAt: new Date(new Date().getTime() + 30 * 60000), // 30 minutes in the future
        data: {
          ...syncResult.value.data,
        },
      };
    }
  } catch (error) {
    console.error(`Error during sync: ${error}`);
    throw error;
  }
};

export const sync = async (
  params: TJsPersonSyncParams,
  opts: {
    noCache?: boolean;
    exisitingEnvironmentState?: TJsEnvironmentState;
    existingPersonState?: TJsPersonState;
  } = {
    noCache: false,
  }
): Promise<void> => {
  try {
    const isEnvironmentStateExpired = opts.exisitingEnvironmentState?.expiresAt
      ? new Date(opts.exisitingEnvironmentState?.expiresAt) < new Date()
      : true;

    const isPersonStateExpired = opts.existingPersonState?.expiresAt
      ? new Date(opts.existingPersonState?.expiresAt) < new Date()
      : true;

    const environmentState = isEnvironmentStateExpired
      ? await syncEnvironmentState(
          { apiHost: params.apiHost, environmentId: params.environmentId },
          opts.noCache
        )
      : opts.exisitingEnvironmentState;

    const personState = isPersonStateExpired
      ? await syncPersonState(params, opts.noCache)
      : opts.existingPersonState;

    const defaultPersonState: TJsPersonState = {
      expiresAt: new Date(new Date().getTime() + 30 * 60000),
      data: {
        userId: params.userId,
        segments: [],
        displays: [],
        responses: [],
        attributes: {},
        lastDisplayAt: null,
      },
    };

    let filteredEnvironmentState: TJsEnvironmentState;

    if (personState === null) {
      filteredEnvironmentState = filterSurveys(environmentState!, defaultPersonState);

      appConfig.update({
        apiHost: params.apiHost,
        environmentId: params.environmentId,
        personState: defaultPersonState,
        environmentState: filteredEnvironmentState,
      });
    } else {
      filteredEnvironmentState = filterSurveys(environmentState!, personState!);

      appConfig.update({
        apiHost: params.apiHost,
        environmentId: params.environmentId,
        personState,
        environmentState: filteredEnvironmentState,
      });
    }

    const surveyNames = filteredEnvironmentState.data.surveys.map((s) => s.name);
    logger.debug("Fetched " + surveyNames.length + " surveys during sync: " + surveyNames.join(", "));
  } catch (error) {
    console.error(`Error during sync: ${error}`);
    throw error;
  }
};

export const addPersonStateExpiryCheckListener = (): void => {
  const updateInterval = 1000 * 30; // every 30 seconds
  // add event listener to check sync person state with backend on regular interval
  if (typeof window !== "undefined" && personStateSyncIntervalId === null) {
    personStateSyncIntervalId = window.setInterval(async () => {
      const expiresAt = appConfig.get().personState.expiresAt;
      try {
        // check if the personState has not expired yet
        if (expiresAt && new Date(expiresAt) >= new Date()) {
          return;
        }

        logger.debug("Person State has expired. Starting sync.");
        const personState = await syncPersonState({
          apiHost: appConfig.get().apiHost,
          environmentId: appConfig.get().environmentId,
          userId: appConfig.get().personState.data.userId!,
        });

        if (personState) {
          appConfig.update({
            ...appConfig.get(),
            personState,
          });
        }
      } catch (e) {
        console.error(`Error during expiry check: ${e}`);
        logger.debug("Extending config and try again later.");
        const existingConfig = appConfig.get();
        appConfig.update(existingConfig);
      }
    }, updateInterval);
  }
};

export const addEnvironmentStateExpiryCheckListener = (): void => {
  let updateInterval = 1000 * 30; // every 30 seconds
  if (typeof window !== "undefined" && environmentStateSyncIntervalId === null) {
    environmentStateSyncIntervalId = window.setInterval(async () => {
      try {
        logger.debug("Syncing Environment State");
        await sync(
          {
            apiHost: appConfig.get().apiHost,
            environmentId: appConfig.get().environmentId,
            userId: appConfig.get().personState.data.userId!,
          },
          {
            noCache: true,
            existingPersonState: appConfig.get().personState,
          }
        );
      } catch (e) {
        console.error(`Error during expiry check: ${e}`);
        logger.debug("Extending config and try again later.");
        const existingConfig = appConfig.get();
        appConfig.update(existingConfig);
      }
    }, updateInterval);
  }
};

export const removeExpiryCheckListener = (): void => {
  if (typeof window !== "undefined" && personStateSyncIntervalId !== null) {
    window.clearInterval(personStateSyncIntervalId);

    personStateSyncIntervalId = null;
  }

  if (typeof window !== "undefined" && environmentStateSyncIntervalId !== null) {
    window.clearInterval(environmentStateSyncIntervalId);

    environmentStateSyncIntervalId = null;
  }
};
