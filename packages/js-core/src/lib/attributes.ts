import { FormbricksAPI } from "@formbricks/api";
import { type TAttributes } from "@formbricks/types/attributes";
import { type ApiErrorResponse } from "@formbricks/types/errors";
import { Config } from "./config";
import { type Result, err, ok, okVoid } from "./errors";
import { Logger } from "./logger";
import { fetchPersonState } from "./person-state";
import { filterSurveys } from "./utils";

const config = Config.getInstance();
const logger = Logger.getInstance();

export const updateAttribute = async (
  key: string,
  value: string | number
): Promise<
  Result<
    {
      changed: boolean;
      message: string;
      messages?: string[];
    },
    ApiErrorResponse
  >
> => {
  const { apiHost, environmentId } = config.get();
  const userId = config.get().personState.data.userId;

  if (!userId) {
    return err({
      code: "network_error",
      status: 500,
      message: "Missing userId",
      url: new URL(`${apiHost}/api/v1/client/${environmentId}/contacts/${userId ?? ""}/attributes`),
      responseMessage: "Missing userId",
    });
  }

  const api = new FormbricksAPI({
    apiHost,
    environmentId,
  });

  const res = await api.client.attribute.update({ userId, attributes: { [key]: value } });

  if (!res.ok) {
    const responseError = res.error;
    if (responseError.details?.ignore) {
      logger.error(responseError.message);
      return {
        ok: true,
        value: {
          changed: false,
          message: res.error.message,
        },
      };
    }

    return err({
      code: res.error.code,
      status: res.error.status,
      message: `Error updating person with userId ${userId}`,
      url: new URL(`${apiHost}/api/v1/client/${environmentId}/contacts/${userId}/attributes`),
      responseMessage: res.error.message,
    });
  }

  const responseMessages = res.data.messages;

  if (responseMessages && responseMessages.length > 0) {
    for (const message of responseMessages) {
      logger.debug(message);
    }
  }

  if (res.data.changed) {
    logger.debug("Attribute updated in Formbricks");

    return {
      ok: true,
      value: {
        changed: true,
        message: "Attribute updated in Formbricks",
        messages: responseMessages,
      },
    };
  }

  return {
    ok: true,
    value: {
      changed: false,
      message: "Attribute not updated in Formbricks",
      messages: responseMessages,
    },
  };
};

export const updateAttributes = async (
  apiHost: string,
  environmentId: string,
  userId: string,
  attributes: TAttributes
): Promise<Result<TAttributes, ApiErrorResponse>> => {
  // clean attributes and remove existing attributes if config already exists
  const updatedAttributes = { ...attributes };

  // send to backend if updatedAttributes is not empty
  if (Object.keys(updatedAttributes).length === 0) {
    logger.debug("No attributes to update. Skipping update.");
    return ok(updatedAttributes);
  }

  logger.debug(`Updating attributes: ${JSON.stringify(updatedAttributes)}`);

  const api = new FormbricksAPI({
    apiHost,
    environmentId,
  });

  const res = await api.client.attribute.update({ userId, attributes: updatedAttributes });

  if (res.ok) {
    if (res.data.messages) {
      for (const message of res.data.messages) {
        logger.debug(message);
      }
    }

    return ok(updatedAttributes);
  }

  const responseError = res.error;

  if (responseError.details?.ignore) {
    logger.error(responseError.message);
    return ok(updatedAttributes);
  }

  return err({
    code: responseError.code,
    status: responseError.status,
    message: `Error updating person with userId ${userId}`,
    url: new URL(`${apiHost}/api/v1/client/${environmentId}/people/${userId}/attributes`),
    responseMessage: responseError.responseMessage,
  });
};

export const setAttributeInApp = async (
  key: string,
  value: string
): Promise<Result<void, ApiErrorResponse>> => {
  if (key === "userId") {
    logger.error("Setting userId is no longer supported. Please set the userId in the init call instead.");
    return okVoid();
  }

  const userId = config.get().personState.data.userId;

  logger.debug(`Setting attribute: ${key} to value: ${value}`);

  if (!userId) {
    logger.error(
      "UserId not provided, please provide a userId in the init method before setting attributes."
    );
    return okVoid();
  }

  const result = await updateAttribute(key, value.toString());

  if (result.ok) {
    if (result.value.changed) {
      const personState = await fetchPersonState(
        {
          apiHost: config.get().apiHost,
          environmentId: config.get().environmentId,
          userId,
        },
        true
      );

      const filteredSurveys = filterSurveys(config.get().environmentState, personState);

      config.update({
        ...config.get(),
        personState,
        filteredSurveys,
        attributes: {
          ...config.get().attributes,
          [key]: value.toString(),
        },
      });
    }

    return okVoid();
  }
  const error = result.error;
  if (error.code === "forbidden") {
    logger.error(`Authorization error: ${error.responseMessage ?? ""}`);
  }

  return err(result.error);
};
