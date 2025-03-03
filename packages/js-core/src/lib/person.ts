import { Config } from "./config";
import { type NetworkError, type Result, err, okVoid } from "./errors";
import { deinitalize, initialize } from "./initialize";
import { Logger } from "./logger";
import { setIsHistoryPatched } from "./no-code-actions";
import { closeSurvey } from "./widget";

const config = Config.getInstance();
const logger = Logger.getInstance();

// eslint-disable-next-line @typescript-eslint/require-await -- There are no promises but our proxy makes the functions async
export const logoutPerson = async (): Promise<Result<void, NetworkError>> => {
  deinitalize();
  config.resetConfig();
  return okVoid();
};

export const resetPerson = async (): Promise<Result<void, NetworkError>> => {
  logger.debug("Resetting state & getting new state from backend");
  closeSurvey();

  const userId = config.get().personState.data.userId;

  const syncParams = {
    environmentId: config.get().environmentId,
    apiHost: config.get().apiHost,
    ...(userId && { userId }),
    attributes: config.get().attributes,
  };

  await logoutPerson();
  setIsHistoryPatched(false);

  try {
    await initialize(syncParams);
    return okVoid();
  } catch (e) {
    return err(e as NetworkError);
  }
};
