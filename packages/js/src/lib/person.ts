import { TJsPeopleAttributeInput, TJsState } from "@formbricks/types/js";
import { TPerson } from "@formbricks/types/people";
import { Config } from "./config";
import {
  AttributeAlreadyExistsError,
  MissingPersonError,
  NetworkError,
  Result,
  err,
  ok,
  okVoid,
} from "./errors";
import { deinitalize, initialize } from "./initialize";
import { Logger } from "./logger";
import { sync } from "./sync";
import { trackAction } from "./actions";

const config = Config.getInstance();
const logger = Logger.getInstance();

export const updatePersonAttribute = async (
  key: string,
  value: string
): Promise<Result<TJsState, NetworkError | MissingPersonError>> => {
  if (!config.get().state.person || !config.get().state.person?.id) {
    return err({
      code: "missing_person",
      message: "Unable to update attribute. No person set.",
    });
  }

  const input: TJsPeopleAttributeInput = {
    environmentId: config.get().environmentId,
    key,
    value,
  };

  const res = await fetch(
    `${config.get().apiHost}/api/v1/js/people/${config.get().state.person?.id}/set-attribute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(input),
    }
  );

  const resJson = await res.json();

  if (!res.ok) {
    return err({
      code: "network_error",
      status: res.status,
      message: "Error updating person",
      url: res.url,
      responseMessage: resJson.message,
    });
  }

  return ok(resJson.data as TJsState);
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

export const setPersonUserId = async (
  userId: string | number
): Promise<Result<void, NetworkError | MissingPersonError | AttributeAlreadyExistsError>> => {
  const existingPerson = config.get().state.person?.id;
  const environmentId = config.get().environmentId;
  const url = `${config.get().apiHost}/api/v1/client/in-app/${environmentId}/${userId}`;

  if (existingPerson) {
    logger.debug("userId already set. Skipping update.");
    return okVoid();
  }

  logger.debug("setting userId: " + userId);

  const personRes = await fetch(url, {
    method: "POST",
    body: JSON.stringify({
      environmentId,
      userId,
    }),
  });

  const jsonRes = (await personRes.json()) as { data: TJsState };

  config.update({
    apiHost: config.get().apiHost,
    environmentId: config.get().environmentId,
    state: jsonRes.data,
  });

  logger.debug("Syncing with backend");

  await sync({
    apiHost: config.get().apiHost,
    environmentId: config.get().environmentId,
    userId: jsonRes.data.person?.userId,
  });

  // check if attribute already exists with this value
  // if (hasAttributeValue("userId", userId.toString())) {
  //   logger.debug("userId already set to this value. Skipping update.");
  //   return okVoid();
  // }

  // if (hasAttributeKey("userId")) {
  //   return err({
  //     code: "attribute_already_exists",
  //     message: "userId cannot be changed after it has been set. You need to reset first",
  //   });
  // }

  // track the new session event after setting the userId

  trackAction("New Session");
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
    const state = result.value;

    config.update({
      apiHost: config.get().apiHost,
      environmentId: config.get().environmentId,
      state,
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
  const syncParams = {
    environmentId: config.get().environmentId,
    apiHost: config.get().apiHost,
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
