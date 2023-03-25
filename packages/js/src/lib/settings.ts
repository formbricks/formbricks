import type { Settings } from "@formbricks/types/js";
import { Config } from "./config";
import { Logger } from "./logger";

const logger = Logger.getInstance();
const config = Config.getInstance();

export const getSettings = async (): Promise<Settings> => {
  const response = await fetch(
    `${config.get().apiHost}/api/v1/client/environments/${config.get().environmentId}/settings`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ personId: config.get().person.id }),
    }
  );
  if (!response.ok) {
    logger.error("Error getting settings");
    throw Error("Error getting settings");
  }
  return response.json();
};

export const refreshSettings = async (): Promise<void> => {
  logger.debug("Refreshing - getting settings from backend");
  const settings = await getSettings();
  config.update({ settings });
};
