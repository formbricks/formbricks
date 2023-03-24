import { Config } from "@formbricks/types/js";
import { Logger } from "./logger";

const logger = Logger.getInstance();

export const retrieveConfig = (): Config => {
  logger.debug("Retrieving config from local storage");
  const configData = localStorage.getItem("formbricks__config");
  if (!configData) {
    logger.debug("No config found in local storage");
    return null;
  }
  logger.debug("Config found in local storage");
  return JSON.parse(configData) as Config;
};

export const persistConfig = (config: Config): void => {
  localStorage.setItem("formbricks__config", JSON.stringify(config));
};

export const removeConfig = (): void => {
  localStorage.removeItem("formbricks__config");
};
