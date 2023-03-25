import type { Person } from "@formbricks/types/js";
import { Session, Settings } from "@formbricks/types/js";
import Config from "./config";
import { Logger } from "./logger";
import { extendSession } from "./session";

const config = Config.get();
const logger = Logger.getInstance();

export const createPerson = async (): Promise<{ session: Session; person: Person; settings: Settings }> => {
  const res = await fetch(`${config.apiHost}/api/v1/client/environments/${config.environmentId}/people`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    console.error("Formbricks: Error fetching person");
    return null;
  }
  return await res.json();
};

export const updatePersonUserId = async (
  userId: string
): Promise<{ person: Person; session: Session; settings: Settings }> => {
  if (!config.person || !config.person.id) {
    console.error("Formbricks: Unable to update userId. No person set.");
    return;
  }
  const res = await fetch(
    `${config.apiHost}/api/v1/client/environments/${config.environmentId}/people/${config.person.id}/user-id`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId, sessionId: config.session.id }),
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
  if (!config.person || !config.person.id) {
    console.error("Formbricks: Unable to update attribute. No person set.");
    return;
  }
  const res = await fetch(
    `${config.apiHost}/api/v1/client/environments/${config.environmentId}/people/${config.person.id}/attribute`,
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
    console.error("Formbricks: Error updating person");
    return;
  }
  return updatedPerson;
};

export const attributeAlreadySet = (key: string, value: string): boolean => {
  const existingAttribute = config.person.attributes.find((a) => a.attributeClass?.name === key);
  if (existingAttribute && existingAttribute.value === value) {
    return true;
  }
  return false;
};

export const attributeAlreadyExists = (key: string): boolean => {
  const existingAttribute = config.person.attributes.find((a) => a.attributeClass?.name === key);
  if (existingAttribute) {
    return true;
  }
  return false;
};

export const setPersonUserId = async (userId: string): Promise<void> => {
  // check if attribute already exists with this value
  if (attributeAlreadySet("userId", userId)) {
    return;
  }
  if (attributeAlreadyExists("userId")) {
    logger.error("Formbricks: userId cannot be changed after it has been set. You need to reset first");
    return;
  }
  const { person, settings } = await updatePersonUserId(userId);
  Config.update({ person, settings });
};

export const setPersonAttribute = async (key: string, value: string): Promise<void> => {
  // check if attribute already exists with this value
  if (attributeAlreadySet(key, value)) {
    return;
  }

  const { person, settings } = await updatePersonAttribute(key, value);
  if (!person || !settings) {
    logger.error("Formbricks: Error updating attribute");
    throw new Error("Formbricks: Error updating attribute");
  }
  Config.update({ person, settings });
};

export const resetPerson = async (): Promise<void> => {
  const { person, session, settings } = await createPerson();
  if (!person || !session || !settings) {
    logger.error("Formbricks: Error resetting user");
    throw new Error("Formbricks: Error resetting user");
  }
  Config.update({ person, session, settings });
};
