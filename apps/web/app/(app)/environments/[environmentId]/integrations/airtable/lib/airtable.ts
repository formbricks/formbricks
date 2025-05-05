import { logger } from "@formbricks/logger";
import { TIntegrationAirtableTables } from "@formbricks/types/integration/airtable";

export const fetchTables = async (environmentId: string, baseId: string) => {
  // [UseTusk]

  const res = await fetch(`/api/v1/integrations/airtable/tables?baseId=${baseId}`, {
    method: "GET",
    headers: { environmentId: environmentId },
    cache: "no-store",
  });
  const resJson = await res.json();
  return resJson.data as Promise<TIntegrationAirtableTables>;
};

export const authorize = async (environmentId: string, apiHost: string): Promise<string> => {
  // [UseTusk]

  const res = await fetch(`${apiHost}/api/v1/integrations/airtable`, {
    method: "GET",
    headers: { environmentId: environmentId },
  });

  if (!res.ok) {
    const errorText = await res.text();
    logger.error({ errorText }, "authorize: Could not fetch airtable config");
    throw new Error("Could not create response");
  }
  const resJSON = await res.json();
  const authUrl = resJSON.data.authUrl;
  return authUrl;
};
