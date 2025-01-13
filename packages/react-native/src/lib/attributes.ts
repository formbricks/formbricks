import { FormbricksAPI } from "@formbricks/api";
import type { TAttributes } from "@formbricks/types/attributes";
import type { ApiErrorResponse } from "@formbricks/types/errors";
import { type Result, err, ok, okVoid } from "../../../js-core/src/lib/errors";
import { Logger } from "../../../js-core/src/lib/logger";
import { filterSurveys } from "../../../js-core/src/lib/utils";
import { RNConfig } from "./config";
import { fetchPersonState } from "./person-state";

const appConfig = RNConfig.getInstance();
const logger = Logger.getInstance();

export const updateAttributes = async (
  apiHost: string,
  environmentId: string,
  userId: string,
  attributes: TAttributes
): Promise<
  Result<
    {
      changed: boolean;
      message: string;
      details?: Record<string, string>;
    },
    ApiErrorResponse
  >
> => {
  // clean attributes and remove existing attributes if config already exists
  const updatedAttributes = { ...attributes };

  logger.debug(`Updating attributes: ${JSON.stringify(updatedAttributes)}`);

  const api = new FormbricksAPI({
    apiHost,
    environmentId,
  });

  const res = await api.client.attribute.update({ userId, attributes: updatedAttributes });

  if (res.ok) {
    if (res.data.details) {
      Object.entries(res.data.details).forEach(([key, value]) => {
        logger.debug(`${key}: ${value}`);
      });
    }

    if (res.data.changed) {
      const message = "Attributes updated in Formbricks";
      logger.debug(message);

      return ok({
        changed: true,
        message,
        ...(res.data.details && {
          details: res.data.details,
        }),
      });
    }

    const message = "Attributes already updated in Formbricks, skipping update.";
    logger.debug(message);

    return ok({
      changed: false,
      message,
      ...(res.data.details && {
        details: res.data.details,
      }),
    });
  }

  const responseError = res.error;

  // We ignore the error and return ok with changed: false
  if (responseError.details?.ignore) {
    logger.error(responseError.message);
    return ok({
      changed: false,
      message: responseError.message,
    });
  }

  return err({
    code: responseError.code,
    status: responseError.status,
    message: `Error updating person with userId ${userId}`,
    url: new URL(`${apiHost}/api/v1/client/${environmentId}/people/${userId}/attributes`),
    responseMessage: responseError.responseMessage,
  });
};

export const setAttributesInApp = async (
  attributes: Record<string, string>
): Promise<Result<void, ApiErrorResponse>> => {
  const { apiHost, environmentId } = appConfig.get();
  const userId = appConfig.get().personState.data.userId;

  // Don't proceed if userId is not set
  if (!userId) {
    logger.error(
      "UserId not provided, please provide a userId through the setUserId method before setting attributes."
    );
    return okVoid();
  }

  // can't pass "{}" as attributes
  if (Object.keys(attributes).length === 0) {
    logger.debug("No attributes to update. Skipping update.");
    return okVoid();
  }

  // can't pass "userId" as a key
  if (attributes.userId) {
    logger.debug(
      "Setting userId is no longer supported. Please set the userId through the setUserId method instead. Skipping userId."
    );
  }

  const { userId: _, ...rest } = attributes;

  const result = await updateAttributes(apiHost, environmentId, userId, rest);

  if (result.ok) {
    if (result.value.changed) {
      const personState = await fetchPersonState(
        {
          apiHost: appConfig.get().apiHost,
          environmentId: appConfig.get().environmentId,
          userId,
        },
        true
      );

      const filteredSurveys = filterSurveys(appConfig.get().environmentState, personState);

      appConfig.update({
        ...appConfig.get(),
        personState,
        filteredSurveys,
        attributes: {
          ...appConfig.get().attributes,
          ...rest,
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
