import type { Person } from "@formbricks/types/js";
import { Session, Settings } from "@formbricks/types/js";
import { Config } from "./config";
import { Logger } from "./logger";

const config = Config.getInstance();
const logger = Logger.getInstance();

export const createPerson = async (): Promise<{ session: Session; person: Person; settings: Settings }> => {
  logger.debug("Creating new person");
  const res = await fetch(
    `${config.get().apiHost}/api/v1/client/environments/${config.get().environmentId}/people`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) {
    console.error("Formbricks: Error fetching person");
    return null;
  }
  return await res.json();
};

export const updatePersonUserId = async (userId: string): Promise<{ person: Person; settings: Settings }> => {
  if (!config.get().person || !config.get().person.id) {
    console.error("Formbricks: Unable to update userId. No person set.");
    return;
  }
  const res = await fetch(
    `${config.get().apiHost}/api/v1/client/environments/${config.get().environmentId}/people/${
      config.get().person.id
    }/user-id`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, sessionId: config.get().session.id }),
    }
  );
  if (!res.ok) {
    logger.error("Formbricks: Error updating person");
    throw Error("Error updating person");
  }
  return await res.json();
};

export const updatePersonAttribute = async (
  key: string,
  value: string
): Promise<{ person: Person; settings: Settings }> => {
  if (!config.get().person || !config.get().person.id) {
    console.error("Formbricks: Unable to update attribute. No person set.");
    return;
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
  const updatedPerson = await res.json();
  if (!res.ok) {
    logger.error("Error updating person");
    throw Error("Error updating person");
  }
  return updatedPerson;
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

export const setPersonUserId = async (userId: string): Promise<void> => {
  logger.debug("setting userId: " + userId);
  // check if attribute already exists with this value
  if (attributeAlreadySet("userId", userId)) {
    logger.debug("userId already set to this value. Skipping update.");
    return;
  }
  if (attributeAlreadyExists("userId")) {
    logger.error("userId cannot be changed after it has been set. You need to reset first");
    return;
  }
  const { person, settings } = await updatePersonUserId(userId);
  config.update({ person, settings });
};

export const setPersonAttribute = async (key: string, value: string): Promise<void> => {
  logger.debug("setting attribute: " + key + " to value: " + value);
  // check if attribute already exists with this value
  if (attributeAlreadySet(key, value)) {
    logger.debug("attribute already set to this value. Skipping update.");
    return;
  }

  const { person, settings } = await updatePersonAttribute(key, value);
  if (!person || !settings) {
    logger.error("Error updating attribute");
    throw new Error("Formbricks: Error updating attribute");
  }
  config.update({ person, settings });
};

export const resetPerson = async (): Promise<void> => {
  logger.debug("Resetting person. Getting new person, session and settings from backend");
  const { person, session, settings } = await createPerson();
  if (!person || !session || !settings) {
    logger.error("Error resetting user");
    throw new Error("Formbricks: Error resetting user");
  }
  config.update({ person, session, settings });
};
