import { Config } from "./config";
import { type NetworkError, type Result, err, okVoid } from "./errors";
import { deinitalize, initialize } from "./initialize";
import { Logger } from "./logger";
import { closeSurvey } from "./widget";

const config = Config.getInstance();
const logger = Logger.getInstance();

export const logoutPerson = (): void => {
  deinitalize();
  config.resetConfig();
};

export const resetPerson = async (): Promise<Result<void, NetworkError>> => {
  logger.debug("Resetting state & getting new state from backend");
  await closeSurvey();

  const userId = config.get().personState.data.userId;

  const syncParams = {
    environmentId: config.get().environmentId,
    apiHost: config.get().apiHost,
    ...(userId && { userId }),
    attributes: config.get().attributes,
  };

  logoutPerson();

  try {
    await initialize(syncParams);
    return okVoid();
  } catch (e) {
    return err(e as NetworkError);
  }
};
