import type { Settings } from "../../../types/js";
import { Config } from "./config";
import { NetworkError, Result, err, ok, okVoid } from "./errors";
import { Logger } from "./logger";

const logger = Logger.getInstance();
const config = Config.getInstance();

export const getSettings = async (): Promise<Result<Settings, NetworkError>> => {
  const url = `${config.get().apiHost}/api/v1/client/environments/${config.get().environmentId}/settings`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ personId: config.get().person.id }),
  });
  if (!response.ok) {
    const jsonRes = await response.json();

    return err({
      code: "network_error",
      status: response.status,
      message: "Error getting settings",
      url,
      responseMessage: jsonRes.message,
    });
  }

  return ok((await response.json()) as Settings);
};

export const refreshSettings = async (): Promise<Result<void, NetworkError>> => {
  logger.debug("Refreshing - getting settings from backend");
  const settings = await getSettings();

  if (settings.ok !== true) return err(settings.error);

  logger.debug("Settings refreshed");
  config.update({ settings: settings.value });

  return okVoid();
};
