import { TPerson, TPersonUpdateInput } from "@formbricks/types/people";
import { Config } from "./config";
import { AttributeAlreadyExistsError, MissingPersonError, NetworkError, Result, err, okVoid } from "./errors";
import { deinitalize, initialize } from "./initialize";
import { Logger } from "./logger";
import { sync } from "./sync";
import { FormbricksAPI } from "@formbricks/api";

const config = Config.getInstance();
const logger = Logger.getInstance();

export const updatePersonAttribute = async (
  key: string,
  value: string
): Promise<Result<void, NetworkError | MissingPersonError>> => {
  if (!config.get().state.person || !config.get().state.person?.id) {
    return err({
      code: "missing_person",
      message: "Unable to update attribute. No person set.",
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
  const res = await api.client.people.update(input, config.get().state.person?.userId);

  if (!res.ok) {
    return err({
      code: "network_error",
      status: 500,
      message: `Error updating person with userId ${config.get().state.person?.userId}`,
      url: `${config.get().apiHost}/api/v1/client/${config.get().environmentId}/people/${
        config.get().state.person?.userId
      }`,
      responseMessage: res.error.message,
    });
  }

  logger.debug("Attribute updated. Syncing...");

  await sync({
    environmentId: config.get().environmentId,
    apiHost: config.get().apiHost,
    userId: config.get().state.person?.userId,
  });

  return okVoid();
};

export const hasAttributeValue = (key: string, value: string): boolean => {
  if (config.get().state.person?.attributes?.[key] === value) {
    return true;
  }
  return false;
};

export const hasAttributeKey = (key: string): boolean => {
  if (config.get().state.person?.attributes?.[key]) {
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
  if (hasAttributeValue(key, value.toString())) {
    logger.debug("Attribute already set to this value. Skipping update.");
    return okVoid();
  }

  const result = await updatePersonAttribute(key, value.toString());

  if (result.ok) {
    return okVoid();
  }

  return err(result.error);
};

export const logoutPerson = async (): Promise<void> => {
  deinitalize();
};

export const resetPerson = async (): Promise<Result<void, NetworkError>> => {
  logger.debug("Resetting state & getting new state from backend");
  const syncParams = {
    environmentId: config.get().environmentId,
    apiHost: config.get().apiHost,
    userId: config.get().state?.person?.userId,
  };
  await logoutPerson();
  try {
    await initialize(syncParams);
    return okVoid();
  } catch (e) {
    return err(e as NetworkError);
  }
};

export const getPerson = (): TPerson | null => {
  return config.get().state.person;
};
