import { JsConfig } from "@formbricks/types/js";
import { Logger } from "./logger";

const logger = Logger.getInstance();

// retrieve config from local storage
export const retrieve = (): JsConfig => {
  logger.debug("Retrieving config from local storage");
  const configData = localStorage.getItem("formbricks__config");
  if (!configData) {
    logger.debug("No config found in local storage");
    return null;
  }
  logger.debug("Config found in local storage");
  return JSON.parse(configData) as JsConfig;
};

// save config to local storage
export const persistConfig = (config: JsConfig): void => {
  localStorage.setItem("formbricks__config", JSON.stringify(config));
};

// remove config from local storage
export const removeConfig = (): void => {
  localStorage.removeItem("formbricks__config");
};
