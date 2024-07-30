import { NetworkError, Result, err, okVoid } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { WebsiteConfig } from "./config";
import { deinitalize, initialize } from "./initialize";
import { closeSurvey } from "./widget";

const websiteConfig = WebsiteConfig.getInstance();
const logger = Logger.getInstance();

export const resetWebsiteConfig = async (): Promise<void> => {
  deinitalize();
  websiteConfig.resetConfig();
};

export const resetConfig = async (): Promise<Result<void, NetworkError>> => {
  logger.debug("Resetting state & getting new state from backend");
  closeSurvey();

  const syncParams = {
    environmentId: websiteConfig.get().environmentId,
    apiHost: websiteConfig.get().apiHost,
  };

  await resetWebsiteConfig();
  try {
    await initialize(syncParams);
    return okVoid();
  } catch (e) {
    return err(e as NetworkError);
  }
};
