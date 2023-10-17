import { TAirtableTables } from "@formbricks/types/v1/integrations";

export const fetchTables = async (environmentId: string, baseId: string) => {
  const res = await fetch(`/api/v1/integrations/airtable/tables?baseId=${baseId}`, {
    method: "GET",
    headers: { environmentId: environmentId },
    cache: "no-store",
  });

  return res.json() as Promise<TAirtableTables>;
};

export const authorize = async (environmentId: string, apiHost: string): Promise<string> => {
  const res = await fetch(`${apiHost}/api/v1/integrations/airtable`, {
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
