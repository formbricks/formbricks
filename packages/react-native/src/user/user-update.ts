/* eslint-disable no-console -- required for logging errors */
import { FormbricksAPI } from "@formbricks/api";
import { RNConfig } from "../common/config";
import { Logger } from "../common/logger";
import { filterSurveys } from "../common/utils";
import { type TUpdates, type TUserState } from "../types/config";
import { type ApiErrorResponse, type Result, err, ok, okVoid } from "../types/error";

const config = RNConfig.getInstance();
const logger = Logger.getInstance();

export const sendUpdatesToBackend = async ({
  apiHost,
  environmentId,
  updates,
}: {
  apiHost: string;
  environmentId: string;
  updates: TUpdates;
}): Promise<
  Result<
    {
      state: TUserState;
      messages?: string[];
    },
    ApiErrorResponse
  >
> => {
  const url = `${apiHost}/api/v1/client/${environmentId}/user`;
  const api = new FormbricksAPI({ apiHost, environmentId });

  try {
    const response = await api.client.user.createOrUpdate({
      userId: updates.userId,
      attributes: updates.attributes,
    });

    if (!response.ok) {
      return err({
        code: response.error.code,
        status: response.error.status,
        message: `Error updating user with userId ${updates.userId}`,
        url: new URL(url),
        responseMessage: response.error.message,
      });
    }

    const { state } = response.data;

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

export const sendUpdates = async ({
  updates,
}: {
  updates: TUpdates;
}): Promise<Result<void, ApiErrorResponse>> => {
  const { appUr;: apiHost, environmentId } = config.get();
  // update endpoint call
  const url = `${apiHost}/api/v1/client/${environmentId}/user`;

  try {
    const updatesResponse = await sendUpdatesToBackend({ apiHost, environmentId, updates });

    if (updatesResponse.ok) {
      const userState = updatesResponse.data.state;
      const filteredSurveys = filterSurveys(config.get().environment, userState);

      // messages => string[] - contains the details of the attributes update
      // for example, if the attribute "email" was being used for some user or not
      const messages = updatesResponse.data.messages;

      if (messages && messages.length > 0) {
        for (const message of messages) {
          logger.debug(`User update message: ${message}`);
        }
      }

      config.update({
        ...config.get(),
        user: {
          ...userState,
        },
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
