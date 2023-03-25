import type { Settings } from "@formbricks/types/js";
import Config from "./config";
import { Logger } from "./logger";

const logger = Logger.getInstance();
const config = Config.get();

export const getSettings = async (): Promise<Settings> => {
  const response = await fetch(
    `${config.apiHost}/api/v1/client/environments/${config.environmentId}/settings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sessionId: config.session.id }),
    }
  );
  if (!response.ok) {
    logger.error("Error getting settings");
    return;
  }
  return await response.json();
};
