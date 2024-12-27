/* eslint-disable @typescript-eslint/no-unnecessary-condition -- could be undefined */
import { FormbricksAPI } from "@formbricks/api";
import type { TAttributes } from "@formbricks/types/attributes";
import type { ForbiddenError, NetworkError } from "@formbricks/types/errors";
import { type Result, err, ok } from "../../../js-core/src/lib/errors";
import { Logger } from "../../../js-core/src/lib/logger";

const logger = Logger.getInstance();

export const updateAttributes = async (
  apiHost: string,
  environmentId: string,
  userId: string,
  attributes: TAttributes
): Promise<Result<TAttributes, NetworkError | ForbiddenError>> => {
  // clean attributes and remove existing attributes if config already exists
  const updatedAttributes = { ...attributes };

  // send to backend if updatedAttributes is not empty
  if (Object.keys(updatedAttributes).length === 0) {
    logger.debug("No attributes to update. Skipping update.");
    return ok(updatedAttributes);
  }

  logger.debug("Updating attributes: " + JSON.stringify(updatedAttributes));

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

    return ok(updatedAttributes);
  }

  // @ts-expect-error -- details could be defined and present
  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access -- details could be defined and present
  if (res.error.details?.ignore) {
    logger.error(res.error.message ?? `Error updating person with userId ${userId}`);
    return ok(updatedAttributes);
  }

  return err({
    code: (res.error as ForbiddenError).code ?? "network_error",
    status: (res.error as NetworkError | ForbiddenError).status ?? 500,
    message: `Error updating person with userId ${userId}`,
    url: new URL(`${apiHost}/api/v1/client/${environmentId}/people/${userId}/attributes`),
    responseMessage: res.error.message,
  });
};
