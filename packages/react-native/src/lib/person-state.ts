import { type TJsPersonState, type TJsPersonSyncParams } from "@formbricks/types/js";
import { err } from "../../../js-core/src/lib/errors";
import { Logger } from "../../../js-core/src/lib/logger";
import { RNConfig } from "./config";

const config = RNConfig.getInstance();
const logger = Logger.getInstance();
let personStateSyncIntervalId: number | null = null;

export const DEFAULT_PERSON_STATE_NO_USER_ID: TJsPersonState = {
  expiresAt: null,
  data: {
    userId: null,
    segments: [],
    displays: [],
    responses: [],
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
  noCache = false
): Promise<TJsPersonState> => {
  const url = `${apiHost}/api/v1/client/${environmentId}/identify/contacts/${userId}`;

  try {
    const fetchOptions: RequestInit = {};

    if (noCache) {
      fetchOptions.cache = "no-cache";
      logger.debug("No cache option set for sync");
    }

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const jsonRes = (await response.json()) as { code: string; message: string };

      const error = err({
        code: jsonRes.code === "forbidden" ? "forbidden" : "network_error",
        status: response.status,
        message: "Error syncing with backend",
        url: new URL(url),
        responseMessage: jsonRes.message,
      });

      // eslint-disable-next-line @typescript-eslint/only-throw-error -- error.error is an Error object
      throw error.error;
    }

    const data = (await response.json()) as { data: TJsPersonState["data"] };
    const { data: state } = data;

    const defaultPersonState: TJsPersonState = {
      expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
      data: {
        userId,
        segments: [],
        displays: [],
        responses: [],
        lastDisplayAt: null,
      },
    };

    if (!Object.keys(state).length) {
      return defaultPersonState;
    }

    return {
      data: { ...state },
      expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
    };
  } catch (e: unknown) {
    const errorTyped = e as { message?: string };

    const error = err({
      code: "network_error",
      message: errorTyped.message ?? "Error fetching the person state",
      status: 500,
      url: new URL(url),
      responseMessage: errorTyped.message ?? "Unknown error",
    });

    // eslint-disable-next-line @typescript-eslint/only-throw-error -- error.error is an Error object
    throw error.error;
  }
};

/**
 * Add a listener to check if the person state has expired with a certain interval
 */
export const addPersonStateExpiryCheckListener = (): void => {
  const updateInterval = 1000 * 60; // every 60 seconds

  if (personStateSyncIntervalId === null) {
    const intervalHandler = (): void => {
      const userId = config.get().personState.data.userId;

      if (!userId) {
        return;
      }

      // extend the personState validity by 30 minutes:
      config.update({
        ...config.get(),
        personState: {
          ...config.get().personState,
          expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
        },
      });
    };

    personStateSyncIntervalId = setInterval(intervalHandler, updateInterval) as unknown as number;
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
