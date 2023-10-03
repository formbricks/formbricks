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
  });

  return res.json() as Promise<TAirtableTables>;
};
