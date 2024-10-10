import { Config } from "./config";
import { NetworkError, Result, err, okVoid } from "./errors";
import { deinitalize, initialize } from "./initialize";
import { Logger } from "./logger";
import { closeSurvey } from "./widget";

const config = Config.getInstance();
const logger = Logger.getInstance();

export const logoutPerson = async (): Promise<void> => {
  deinitalize();
  config.resetConfig();
};

export const resetPerson = async (): Promise<Result<void, NetworkError>> => {
  logger.debug("Resetting state & getting new state from backend");
  closeSurvey();

  const userId = config.get().personState.data.userId;

  const syncParams = {
    environmentId: config.get().environmentId,
    apiHost: config.get().apiHost,
    ...(userId && { userId }),
    attributes: config.get().personState.data.attributes,
  };
  await logoutPerson();
  try {
    await initialize(syncParams);
    return okVoid();
  } catch (e) {
    return err(e as NetworkError);
  }
};
