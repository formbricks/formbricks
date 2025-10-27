import { logger } from "@formbricks/logger";

export const authorize = async (environmentId: string, apiHost: string): Promise<string> => {
  const res = await fetch(`${apiHost}/api/v1/integrations/slack`, {
    method: "GET",
    headers: { environmentId },
  });

  if (!res.ok) {
    const errorText = await res.text();
    logger.error({ errorText }, "authorize: Could not fetch slack config");
    throw new Error("Could not create response");
  }
  const resJSON = await res.json();
  const authUrl = resJSON.data.authUrl;
  return authUrl;
};
