import type { Config } from "@formbricks/types/js";

export const createPerson = async (config: Config) => {
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
  const person = await res.json();
  localStorage.setItem("formbricks__person", JSON.stringify(person));
  return person;
};

export const getLocalPerson = () => {
  const personData = localStorage.getItem("formbricks__person");
  if (personData) {
    return JSON.parse(personData);
  }
  return null;
};

export const updatePersonUserId = async (config: Config, userId: string) => {
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
  const updatedPerson = await res.json();
  if (!res.ok) {
    console.error("Formbricks: Error updating person");
    return;
  }
  // save to local storage
  localStorage.setItem("formbricks__person", JSON.stringify(updatedPerson));
  return updatedPerson;
};

export const updatePersonAttribute = async (config: Config, key: string, value: string) => {
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
  // save to local storage
  localStorage.setItem("formbricks__person", JSON.stringify(updatedPerson));
  return updatedPerson;
};

export const attributeAlreadySet = (config: Config, key: string, value: string) => {
  const existingAttribute = config.person.attributes.find((a) => a.attributeClass?.name === key);
  if (existingAttribute && existingAttribute.value === value) {
    return true;
  }
  return false;
};

export const attributeAlreadyExists = (config: Config, key: string) => {
  const existingAttribute = config.person.attributes.find((a) => a.attributeClass?.name === key);
  if (existingAttribute) {
    return true;
  }
  return false;
};
