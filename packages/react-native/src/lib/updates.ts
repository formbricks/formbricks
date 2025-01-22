/* eslint-disable no-console -- required for logging errors */
import { FormbricksAPI } from "@formbricks/api";
import { type TJsUpdates, type TJsUserState } from "../types/config";
import { type ApiErrorResponse, type Result, err, ok, okVoid } from "../types/errors";
import { RNConfig } from "./config";
import { Logger } from "./logger";
import { filterSurveys } from "./utils";

const config = RNConfig.getInstance();
const logger = Logger.getInstance();

export const sendUpdatesToBackend = async (
  {
    apiHost,
    environmentId,
    updates,
  }: {
    apiHost: string;
    environmentId: string;
    updates: TJsUpdates;
  },
  noCache = false
): Promise<
  Result<
    {
      state: TJsUserState;
      details?: Record<string, string>;
    },
    ApiErrorResponse
  >
> => {
  const url = `${apiHost}/api/v1/client/${environmentId}/update/contacts/${updates.userId}`;

  const api = new FormbricksAPI({ apiHost, environmentId });

  try {
    const fetchOptions: RequestInit = {};

    if (noCache) {
      fetchOptions.cache = "no-cache";
      logger.debug("No cache option set for sync");
    }

    const response = await api.client.user.createOrUpdate({
      userId: updates.userId,
      attributes: updates.attributes,
    });

    if (!response.ok) {
      console.log("from error: ", JSON.stringify(response, null, 2));
      return err({
        code: response.error.code,
        status: response.error.status,
        message: `Error updating user with userId ${updates.userId}`,
        url: new URL(`${apiHost}/api/v1/client/${environmentId}/update/contacts/${updates.userId}`),
        responseMessage: response.error.message,
      });
    }

    const { state } = response.data;

    // const defaultPersonState: TJsPersonState = {
    //   expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
    //   data: {
    //     userId: updates.userId,
    //     segments: [],
    //     displays: [],
    //     responses: [],
    //     lastDisplayAt: null,
    //   },
    // };

    // if (!Object.keys(state).length) {
    //   return ok({ state: defaultPersonState });
    // }

    // return {
    //   data: { ...state },
    //   expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
    // };

    return ok({
      state: {
        expiresAt: new Date(new Date().getTime() + 1000 * 60 * 30), // 30 minutes
        data: {
          ...state,
        },
      },
    });
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
): Promise<Result<void, ApiErrorResponse>> => {
  const { apiHost, environmentId } = config.get();
  // update endpoint call
  const url = `${apiHost}/api/v1/client/${environmentId}/update/contacts/${updates.userId}`;

  try {
    const updatesResponse = await sendUpdatesToBackend({ apiHost, environmentId, updates }, noCache);

    if (updatesResponse.ok) {
      // data => {state: TJsPersonState; details?: Record<string, string> }
      const personState = updatesResponse.data.state;
      const filteredSurveys = filterSurveys(config.get().environment, personState);

      // details => Record<string, string> - contains the details of the attributes update
      // for example, if the attribute "email" was being used for some user or not
      // we should log the details
      const details = updatesResponse.data.details;

      if (details && Object.keys(details).length > 0) {
        for (const [key, value] of Object.entries(details)) {
          logger.debug(`Attribute ${key} update details: ${value}`);
        }
      }

      config.update({
        ...config.get(),
        user: personState,
        filteredSurveys,
      });

      return okVoid();
    }

    return err(updatesResponse.error);
  } catch (e) {
    console.error("error in sending updates: ", e);

    return err({
      code: "network_error",
      message: "Error sending updates",
      status: 500,
      url: new URL(url),
      responseMessage: "Unknown error",
    });
  }
};
