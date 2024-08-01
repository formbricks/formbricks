import { FormbricksAPI } from "@formbricks/api";
import { TAttributes } from "@formbricks/types/attributes";
import { MissingPersonError, NetworkError, Result, err, ok, okVoid } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { AppConfig } from "./config";

const logger = Logger.getInstance();

export const updateAttribute = async (
  key: string,
  value: string,
  appConfig: AppConfig
): Promise<Result<void, NetworkError>> => {
  const { apiHost, environmentId, userId } = appConfig.get();

  const api = new FormbricksAPI({
    apiHost,
    environmentId,
  });

  const res = await api.client.attribute.update({ userId, attributes: { [key]: value } });

  if (!res.ok) {
    // @ts-expect-error
    if (res.error.details?.ignore) {
      logger.error(res.error.message ?? `Error updating person with userId ${userId}`);
      return okVoid();
    }
    return err({
      code: "network_error",
      // @ts-expect-error
      status: res.error.status ?? 500,
      message: res.error.message ?? `Error updating person with userId ${userId}`,
      url: `${appConfig.get().apiHost}/api/v1/client/${environmentId}/people/${userId}/attributes`,
      responseMessage: res.error.message,
    });
  }

  if (res.data.changed) {
    logger.debug("Attribute updated in Formbricks");
  }

  return okVoid();
};

export const updateAttributes = async (
  apiHost: string,
  environmentId: string,
  userId: string,
  attributes: TAttributes,
  appConfig: AppConfig
): Promise<Result<TAttributes, NetworkError>> => {
  // clean attributes and remove existing attributes if config already exists
  const updatedAttributes = { ...attributes };

  try {
    const existingAttributes = appConfig.get()?.state?.attributes;
    if (existingAttributes) {
      for (const [key, value] of Object.entries(existingAttributes)) {
        if (updatedAttributes[key] === value) {
          delete updatedAttributes[key];
        }
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

  logger.debug("Updating attributes: " + JSON.stringify(updatedAttributes));

  const api = new FormbricksAPI({
    apiHost,
    environmentId,
  });

  const res = await api.client.attribute.update({ userId, attributes: updatedAttributes });

  if (res.ok) {
    return ok(updatedAttributes);
  } else {
    // @ts-expect-error
    if (res.error.details?.ignore) {
      logger.error(res.error.message ?? `Error updating person with userId ${userId}`);
      return ok(updatedAttributes);
    }

    return err({
      code: "network_error",
      status: 500,
      message: `Error updating person with userId ${userId}`,
      url: `${apiHost}/api/v1/client/${environmentId}/people/${userId}/attributes`,
      responseMessage: res.error.message,
    });
  }
};

export const isExistingAttribute = (key: string, value: string, appConfig: AppConfig): boolean => {
  if (appConfig.get().state.attributes[key] === value) {
    return true;
  }
  return false;
};

export const setAttributeInApp = async (
  key: string,
  value: any,
  appConfig: AppConfig
): Promise<Result<void, NetworkError | MissingPersonError>> => {
  if (key === "userId") {
    logger.error("Setting userId is no longer supported. Please set the userId in the init call instead.");
    return okVoid();
  }

  logger.debug("Setting attribute: " + key + " to value: " + value);
  // check if attribute already exists with this value
  if (isExistingAttribute(key, value.toString(), appConfig)) {
    logger.debug("Attribute already set to this value. Skipping update.");
    return okVoid();
  }

  const result = await updateAttribute(key, value.toString(), appConfig);

  if (result.ok) {
    // udpdate attribute in config
    appConfig.update({
      environmentId: appConfig.get().environmentId,
      apiHost: appConfig.get().apiHost,
      userId: appConfig.get().userId,
      state: {
        ...appConfig.get().state,
        attributes: {
          ...appConfig.get().state.attributes,
          [key]: value.toString(),
        },
      },
      expiresAt: appConfig.get().expiresAt,
    });
    return okVoid();
  }

  return err(result.error);
};
