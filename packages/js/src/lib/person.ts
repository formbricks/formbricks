import type { Config } from "../types/types";

export const createPerson = async (config: Config) => {
  const res = await fetch(`${config.apiHost}/api/v1/environments/${config.environmentId}/client/people`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    console.error("Error fetching person");
    return null;
  }
  const person = await res.json();
  return person;
};

export const getLocalPerson = () => {
  const personData = localStorage.getItem("formbricks__person");
  if (personData) {
    return JSON.parse(personData);
  }
  return null;
};
