/* eslint-disable no-console -- required for logging errors */
import { type TJsPersonState, type TJsUpdates } from "../types/config";
import { err } from "../types/errors";
import { RNConfig } from "./config";
import { Logger } from "./logger";
import { filterSurveys } from "./utils";

const config = RNConfig.getInstance();
const logger = Logger.getInstance();

export const sendUpdatesToBackend = async (
  {
    updates,
  }: {
    updates: TJsUpdates;
  },
  noCache = false
): Promise<TJsPersonState> => {
  const { apiHost, environmentId } = config.get();
  // update endpoint call
  const url = `${apiHost}/api/v1/client/${environmentId}/update/contacts/${updates.userId}`;

  try {
    const fetchOptions: RequestInit = {};

    if (noCache) {
      fetchOptions.cache = "no-cache";
      logger.debug("No cache option set for sync");
    }

    const response = await fetch(url, {
      ...fetchOptions,
      method: "POST",
      body: JSON.stringify({
        attributes: updates.attributes,
      }),
    });

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

    const responseData = (await response.json()) as {
      data: {
        state: TJsPersonState["data"];
        details?: Record<string, string>;
      };
    };

    const { state } = responseData.data;

    const defaultPersonState: TJsPersonState = {
      expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
      data: {
        userId: updates.userId,
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

export const sendUpdates = async (
  {
    updates,
  }: {
    updates: TJsUpdates;
  },
  noCache = false
) => {
  try {
    const personState = await sendUpdatesToBackend({ updates }, noCache);

    const filteredSurveys = filterSurveys(config.get().environmentState, personState);

    config.update({
      ...config.get(),
      personState,
      filteredSurveys,
    });
  } catch (e) {
    console.error("error in sending updates: ", e);
  }
};
