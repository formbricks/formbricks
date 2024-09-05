/* eslint-disable @typescript-eslint/no-unsafe-member-access -- required */

/* eslint-disable @typescript-eslint/no-dynamic-delete -- required */
import { FormbricksAPI } from "@formbricks/api";
import type { TAttributes } from "@formbricks/types/attributes";
import { type Result, err, ok } from "@formbricks/types/error-handlers";
import type { NetworkError } from "@formbricks/types/errors";
import { Logger } from "../../../js-core/src/shared/logger";
import { appConfig } from "./config";

const logger = Logger.getInstance();

export const updateAttributes = async (
  apiHost: string,
  environmentId: string,
  userId: string,
  attributes: TAttributes
): Promise<Result<TAttributes, NetworkError>> => {
  // clean attributes and remove existing attributes if config already exists
  const updatedAttributes = { ...attributes };

  try {
    const existingAttributes = appConfig.get().state.attributes;
    for (const [key, value] of Object.entries(existingAttributes)) {
      if (updatedAttributes[key] === value) {
        delete updatedAttributes[key];
      }
    }
  } catch (e) {
    logger.debug("config not set; sending all attributes to backend");
  }

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
    return ok(updatedAttributes);
  }
  // @ts-expect-error -- required because we set ignore
  if (res.error.details?.ignore) {
    logger.error(`Error updating person with userId ${userId}`);
    return ok(updatedAttributes);
  }

  return err({
    code: "network_error",
    status: 500,
    message: `Error updating person with userId ${userId}`,
    url: new URL(`${apiHost}/api/v1/client/${environmentId}/people/${userId}/attributes`),
    responseMessage: res.error.message,
  });
};
