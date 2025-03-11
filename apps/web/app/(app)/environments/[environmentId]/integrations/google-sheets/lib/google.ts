import { logger } from "@formbricks/logger";

export const authorize = async (environmentId: string, apiHost: string): Promise<string> => {
  const res = await fetch(`${apiHost}/api/google-sheet`, {
    method: "GET",
    headers: { environmentId: environmentId },
  });

  if (!res.ok) {
    logger.warn(res.text);
    throw new Error("Could not create response");
  }
  const resJSON = await res.json();
  const authUrl = resJSON.data.authUrl;
  return authUrl;
};
