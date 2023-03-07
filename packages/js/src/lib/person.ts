import type { Config } from "../types/types";

export const getNewPerson = async (config: Config) => {
  const res = await fetch(`${config.apiHost}/api/v1/environments/${config.environmentId}/client/people`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    console.error("Error fetching person");
    return;
  }
  const person = await res.json();
  return person;
};
