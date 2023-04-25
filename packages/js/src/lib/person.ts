import type { Person } from "@formbricks/types/js";
import { Session, Settings } from "@formbricks/types/js";
import { Config } from "./config";
import {
  AttributeAlreadyExistsError,
  MissingPersonError,
  NetworkError,
  Result,
  err,
  match,
  ok,
  okVoid,
} from "./errors";
import { Logger } from "./logger";

const config = Config.getInstance();
const logger = Logger.getInstance();

export const createPerson = async (): Promise<
  Result<{ session: Session; person: Person; settings: Settings }, NetworkError>
> => {
  logger.debug("Creating new person");
  const url = `${config.get().apiHost}/api/v1/client/environments/${config.get().environmentId}/people`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });

  const jsonRes = await res.json();

  if (!res.ok) {
    return err({
      code: "network_error",
      message: "Error creating person",
      status: res.status,
      url,
      responseMessage: jsonRes.message,
    });
  }

  return ok(jsonRes as { session: Session; person: Person; settings: Settings });
};

export const updatePersonUserId = async (
  userId: string
): Promise<Result<{ person: Person; settings: Settings }, NetworkError | MissingPersonError>> => {
  if (!config.get().person || !config.get().person.id)
    return err({
      code: "missing_person",
      message: "Unable to update userId. No person set.",
    });

  const url = `${config.get().apiHost}/api/v1/client/environments/${config.get().environmentId}/people/${
    config.get().person.id
  }/user-id`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ userId, sessionId: config.get().session.id }),
  });

  const jsonRes = await res.json();

  if (!res.ok) {
    return err({
      code: "network_error",
      message: "Error updating person",
      status: res.status,
      url,
      responseMessage: jsonRes.message,
    });
  }

  return ok(jsonRes as { person: Person; settings: Settings });
};

export const updatePersonAttribute = async (
  key: string,
  value: string
): Promise<Result<{ person: Person; settings: Settings }, NetworkError | MissingPersonError>> => {
  if (!config.get().person || !config.get().person.id) {
    return err({
      code: "missing_person",
      message: "Unable to update attribute. No person set.",
    });
  }

  const res = await fetch(
    `${config.get().apiHost}/api/v1/client/environments/${config.get().environmentId}/people/${
      config.get().person.id
    }/attribute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key, value }),
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

  return ok(resJson as { person: Person; settings: Settings });
};

export const attributeAlreadySet = (key: string, value: string): boolean => {
  const existingAttribute = config.get().person.attributes.find((a) => a.attributeClass?.name === key);
  if (existingAttribute && existingAttribute.value === value) {
    return true;
  }
  return false;
};

export const attributeAlreadyExists = (key: string): boolean => {
  const existingAttribute = config.get().person.attributes.find((a) => a.attributeClass?.name === key);
  if (existingAttribute) {
    return true;
  }
  return false;
};

export const setPersonUserId = async (
  userId: string
): Promise<Result<void, NetworkError | MissingPersonError | AttributeAlreadyExistsError>> => {
  logger.debug("setting userId: " + userId);
  // check if attribute already exists with this value
  if (attributeAlreadySet("userId", userId)) {
    logger.debug("userId already set to this value. Skipping update.");
    return okVoid();
  }
  if (attributeAlreadyExists("userId")) {
    return err({
      code: "attribute_already_exists",
      message: "userId cannot be changed after it has been set. You need to reset first",
    });
  }
  const result = await updatePersonUserId(userId);

  if (result.ok !== true) return err(result.error);

  const { person, settings } = result.value;

  config.update({ person, settings });

  return okVoid();
};

export const setPersonAttribute = async (
  key: string,
  value: string
): Promise<Result<void, NetworkError | MissingPersonError>> => {
  logger.debug("setting attribute: " + key + " to value: " + value);
  // check if attribute already exists with this value
  if (attributeAlreadySet(key, value)) {
    logger.debug("attribute already set to this value. Skipping update.");
    return okVoid();
  }

  const result = await updatePersonAttribute(key, value);

  let error: NetworkError | MissingPersonError;

  match(
    result,
    ({ person, settings }) => {
      config.update({ person, settings });
    },
    (err) => {
      // pass error to outer scope
      error = err;
    }
  );

  if (error) {
    return err(error);
  }

  return okVoid();
};

export const resetPerson = async (): Promise<Result<void, NetworkError>> => {
  logger.debug("Resetting person. Getting new person, session and settings from backend");
  const result = await createPerson();

  let error: NetworkError;

  match(
    result,
    ({ person, session, settings }) => {
      config.update({ person, session, settings });
    },
    (err) => {
      // pass error to outer scope
      error = err;
    }
  );

  if (error) {
    return err(error);
  }

  return okVoid();
};
