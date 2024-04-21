import { FormbricksAPI } from "@formbricks/api";
import { TPersonAttributes, TPersonUpdateInput } from "@formbricks/types/people";

import { MissingPersonError, NetworkError, Result, err, ok, okVoid } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { InAppConfig } from "./config";
import { deinitalize, initialize } from "./initialize";
import { closeSurvey } from "./widget";

const inAppConfig = InAppConfig.getInstance();
const logger = Logger.getInstance();

export const updatePersonAttribute = async (
  key: string,
  value: string
): Promise<Result<void, NetworkError | MissingPersonError>> => {
  const { apiHost, environmentId, userId } = inAppConfig.get();

  const input: TPersonUpdateInput = {
    attributes: {
      [key]: value,
    },
  };

  const api = new FormbricksAPI({
    apiHost,
    environmentId,
  });

  const res = await api.client.people.update(userId, input);

  if (!res.ok) {
    return err({
      code: "network_error",
      status: 500,
      message: `Error updating person with userId ${userId}`,
      url: `${inAppConfig.get().apiHost}/api/v1/client/${environmentId}/people/${userId}`,
      responseMessage: res.error.message,
    });
  }

  if (res.data.changed) {
    logger.debug("Attribute updated in Formbricks");
  }

  return okVoid();
};

export const updatePersonAttributes = async (
  apiHost: string,
  environmentId: string,
  userId: string,
  attributes: TPersonAttributes
): Promise<Result<TPersonAttributes, NetworkError | MissingPersonError>> => {
  // clean attributes and remove existing attributes if config already exists
  const updatedAttributes = { ...attributes };

  try {
    const existingAttributes = inAppConfig.get()?.state?.attributes;
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

  const input: TPersonUpdateInput = {
    attributes: updatedAttributes,
  };

  const api = new FormbricksAPI({
    apiHost,
    environmentId,
  });

  const res = await api.client.people.update(userId, input);

  if (res.ok) {
    return ok(updatedAttributes);
  }

  return err({
    code: "network_error",
    status: 500,
    message: `Error updating person with userId ${userId}`,
    url: `${apiHost}/api/v1/client/${environmentId}/people/${userId}`,
    responseMessage: res.error.message,
  });
};

export const isExistingAttribute = (key: string, value: string): boolean => {
  if (inAppConfig.get().state.attributes[key] === value) {
    return true;
  }
  return false;
};

export const setPersonAttribute = async (
  key: string,
  value: any
): Promise<Result<void, NetworkError | MissingPersonError>> => {
  if (key === "userId") {
    logger.error("Setting userId is no longer supported. Please set the userId in the init call instead.");
    return okVoid();
  }

  logger.debug("Setting attribute: " + key + " to value: " + value);
  // check if attribute already exists with this value
  if (isExistingAttribute(key, value.toString())) {
    logger.debug("Attribute already set to this value. Skipping update.");
    return okVoid();
  }

  const result = await updatePersonAttribute(key, value.toString());

  if (result.ok) {
    // udpdate attribute in config
    inAppConfig.update({
      environmentId: inAppConfig.get().environmentId,
      apiHost: inAppConfig.get().apiHost,
      userId: inAppConfig.get().userId,
      state: {
        ...inAppConfig.get().state,
        attributes: {
          ...inAppConfig.get().state.attributes,
          [key]: value.toString(),
        },
      },
      expiresAt: inAppConfig.get().expiresAt,
    });
    return okVoid();
  }

  return err(result.error);
};

export const logoutPerson = async (): Promise<void> => {
  deinitalize();
  inAppConfig.resetConfig();
};

export const resetPerson = async (): Promise<Result<void, NetworkError>> => {
  logger.debug("Resetting state & getting new state from backend");
  closeSurvey();
  const syncParams = {
    environmentId: inAppConfig.get().environmentId,
    apiHost: inAppConfig.get().apiHost,
    userId: inAppConfig.get().userId,
    attributes: inAppConfig.get().state.attributes,
  };
  await logoutPerson();
  try {
    await initialize(syncParams);
    return okVoid();
  } catch (e) {
    return err(e as NetworkError);
  }
};
