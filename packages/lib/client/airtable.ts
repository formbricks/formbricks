import { TAirtableTables } from "services/airTable";

export const createIntegration = async (environmentId: string, key: String) => {
  const res = await fetch(`/api/airtable`, {
    method: "POST",
    headers: { environmentId: environmentId },
    body: JSON.stringify({ key }),
  });

  return res.json();
};

export const fetchTables = async (environmentId: string, baseId: string) => {
  const res = await fetch(`/api/airtable/tables?baseId=${baseId}`, {
    method: "GET",
    headers: { environmentId: environmentId },
    cache: "no-store",
  });

  return res.json() as Promise<TAirtableTables>;
};

export const authorize = async (environmentId: string, apiHost: string): Promise<string> => {
  const res = await fetch(`${apiHost}/api/airtable`, {
    method: "GET",
    headers: { environmentId: environmentId },
  });

  if (!res.ok) {
    console.error(res.text);
    throw new Error("Could not create response");
  }
  const resJSON = await res.json();
  const authUrl = resJSON.authUrl;
  return authUrl;
};
