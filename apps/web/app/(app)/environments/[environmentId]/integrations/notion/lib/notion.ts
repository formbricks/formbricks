import { logger } from "@formbricks/logger";

export const authorize = async (environmentId: string, apiHost: string): Promise<string> => {
  const res = await fetch(`${apiHost}/api/v1/integrations/notion`, {
    method: "GET",
    headers: { environmentId: environmentId },
  });

  if (!res.ok) {
    const errorText = await res.text();
    logger.error({ errorText }, "authorize: Could not fetch notion config");
    throw new Error("Could not create response");
  }
  const resJSON = await res.json();
  const authUrl = resJSON.data.authUrl;
  return authUrl;
};
