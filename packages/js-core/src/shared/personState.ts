import { TJsPersonState, TJsPersonSyncParams } from "@formbricks/types/js";
import { AppConfig } from "../app/lib/config";
import { err } from "./errors";
import { Logger } from "./logger";
import { filterSurveys, getIsDebug } from "./utils";

const logger = Logger.getInstance();
let personStateSyncIntervalId: number | null = null;

export const DEFAULT_PERSON_STATE_WEBSITE: TJsPersonState = {
  expiresAt: null,
  data: {
    userId: null,
    segments: [],
    displays: [],
    responses: [],
    attributes: {},
    lastDisplayAt: null,
  },
} as const;

/**
 * Fetch the person state from the backend
 * @param apiHost - The API host
 * @param environmentId - The environment ID
 * @param userId - The user ID
 * @param noCache - Whether to skip the cache
 * @returns The person state
 * @throws NetworkError
 */
export const fetchPersonState = async (
  { apiHost, environmentId, userId }: TJsPersonSyncParams,
  noCache: boolean = false
): Promise<TJsPersonState> => {
  let fetchOptions: RequestInit = {};

  if (noCache || getIsDebug()) {
    fetchOptions.cache = "no-cache";
    logger.debug("No cache option set for sync");
  }

  const url = `${apiHost}/api/v1/client/${environmentId}/app/people/${userId}`;

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

  const defaultPersonState: TJsPersonState = {
    expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
    data: {
      userId,
      segments: [],
      displays: [],
      responses: [],
      attributes: {},
      lastDisplayAt: null,
    },
  };

  if (!Object.keys(state).length) {
    return defaultPersonState;
  }

  return {
    data: { ...(state as TJsPersonState["data"]) },
    expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
  };
};

/**
 * Add a listener to check if the person state has expired with a certain interval
 * @param appConfig - The app config
 */
export const addPersonStateExpiryCheckListener = (appConfig: AppConfig): void => {
  const updateInterval = 1000 * 30; // every 30 seconds

  if (typeof window !== "undefined" && personStateSyncIntervalId === null) {
    personStateSyncIntervalId = window.setInterval(async () => {
      const userId = appConfig.get().personState.data.userId;

      if (!userId) {
        return;
      }

      // we fetch the person state from the backend and update the config
      const personState = await fetchPersonState(
        {
          apiHost: appConfig.get().apiHost,
          environmentId: appConfig.get().environmentId,
          userId,
        },
        true
      );
      const environmentState = appConfig.get().environmentState;
      const filteredSurveys = filterSurveys(environmentState, personState);

      appConfig.update({
        ...appConfig.get(),
        personState,
        filteredSurveys,
      });
    }, updateInterval);
  }
};

/**
 * Clear the person state expiry check listener
 */
export const clearPersonStateExpiryCheckListener = (): void => {
  if (personStateSyncIntervalId) {
    clearInterval(personStateSyncIntervalId);
    personStateSyncIntervalId = null;
  }
};
