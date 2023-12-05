import { FormbricksAPI } from "@formbricks/api";
import { TPersonAttributes, TPersonUpdateInput } from "@formbricks/types/people";
import { Config } from "./config";
import { AttributeAlreadyExistsError, MissingPersonError, NetworkError, Result, err, okVoid } from "./errors";
import { deinitalize, initialize } from "./initialize";
import { Logger } from "./logger";
import { sync } from "./sync";
import { closeSurvey } from "./widget";

const config = Config.getInstance();
const logger = Logger.getInstance();

export const updatePersonAttribute = async (
  key: string,
  value: string
): Promise<Result<void, NetworkError | MissingPersonError>> => {
  const { apiHost, environmentId, userId } = config.get();
  if (!userId) {
    return err({
      code: "missing_person",
      message: "Unable to update attribute. User identification deactivated. No userId set.",
    });
  }

  const input: TPersonUpdateInput = {
    attributes: {
      [key]: value,
    },
  };

  const api = new FormbricksAPI({
    apiHost: config.get().apiHost,
    environmentId: config.get().environmentId,
  });
  const res = await api.client.people.update(userId, input);

  if (!res.ok) {
    return err({
      code: "network_error",
      status: 500,
      message: `Error updating person with userId ${userId}`,
      url: `${config.get().apiHost}/api/v1/client/${environmentId}/people/${userId}`,
      responseMessage: res.error.message,
    });
  }

  logger.debug("Attribute updated. Syncing...");

  await sync({
    environmentId: environmentId,
    apiHost: apiHost,
    userId: userId,
  });

  return okVoid();
};

export const updatePersonAttributes = async (
  attributes: TPersonAttributes
): Promise<Result<void, NetworkError | MissingPersonError>> => {
  const { apiHost, environmentId, userId } = config.get();

  if (!userId) {
    return err({
      code: "missing_person",
      message: "Unable to update attribute. User identification deactivated. No userId set.",
    });
  }

  const attributesToUpdate: TPersonAttributes = {};
  for (const [key, value] of Object.entries(attributes)) {
    if (!isExistingAttribute(key, value.toString())) {
      attributesToUpdate[key] = value;
    }
  }

  if (Object.keys(attributesToUpdate).length === 0) {
    logger.debug("No attributes to update. Skipping update.");
    return okVoid();
  }

  const input: TPersonUpdateInput = {
    attributes: attributesToUpdate,
  };

  const api = new FormbricksAPI({
    apiHost: config.get().apiHost,
    environmentId: config.get().environmentId,
  });

  const res = await api.client.people.update(userId, input);

  if (res.ok) {
    config.update({
      environmentId: config.get().environmentId,
      apiHost: config.get().apiHost,
      userId: config.get().userId,
      state: {
        ...config.get().state,
        attributes: attributesToUpdate,
      },
    });

    logger.debug("Attributes updated. Syncing...");

    await sync({
      environmentId: environmentId,
      apiHost: apiHost,
      userId: userId,
    });

    return okVoid();
  }

  return err({
    code: "network_error",
    status: 500,
    message: `Error updating person with userId ${userId}`,
    url: `${config.get().apiHost}/api/v1/client/${environmentId}/people/${userId}`,
    responseMessage: res.error.message,
  });
};

export const isExistingAttribute = (key: string, value: string): boolean => {
  if (config.get().state.attributes[key] === value) {
    return true;
  }
  return false;
};

export const setPersonUserId = async (): Promise<
  Result<void, NetworkError | MissingPersonError | AttributeAlreadyExistsError>
> => {
  logger.error("'setUserId' is no longer supported. Please set the userId in the init call instead.");
  return okVoid();
};

export const setPersonAttribute = async (
  key: string,
  value: any
): Promise<Result<void, NetworkError | MissingPersonError>> => {
  logger.debug("Setting attribute: " + key + " to value: " + value);
  // check if attribute already exists with this value
  if (isExistingAttribute(key, value.toString())) {
    logger.debug("Attribute already set to this value. Skipping update.");
    return okVoid();
  }

  const result = await updatePersonAttribute(key, value.toString());

  if (result.ok) {
    // udpdate attribute in config
    config.update({
      environmentId: config.get().environmentId,
      apiHost: config.get().apiHost,
      userId: config.get().userId,
      state: {
        ...config.get().state,
        attributes: {
          ...config.get().state.attributes,
          [key]: value.toString(),
        },
      },
    });
    return okVoid();
  }

  return err(result.error);
};

export const logoutPerson = async (): Promise<void> => {
  deinitalize();
};

export const resetPerson = async (): Promise<Result<void, NetworkError>> => {
  logger.debug("Resetting state & getting new state from backend");
  closeSurvey();
  const syncParams = {
    environmentId: config.get().environmentId,
    apiHost: config.get().apiHost,
    userId: config.get().userId,
  };
  await logoutPerson();
  try {
    await initialize(syncParams);
    return okVoid();
  } catch (e) {
    return err(e as NetworkError);
  }
};
