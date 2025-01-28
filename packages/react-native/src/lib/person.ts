import { type NetworkError, type Result, err, okVoid } from "../../../js-core/src/lib/errors";
import { Logger } from "../../../js-core/src/lib/logger";
import { RNConfig } from "./config";
import { deinitalize, initialize } from "./initialize";

const appConfig = RNConfig.getInstance();
const logger = Logger.getInstance();

export const logoutPerson = async (): Promise<void> => {
  await deinitalize();
  await appConfig.resetConfig();
};

export const resetPerson = async (): Promise<Result<void, NetworkError>> => {
  logger.debug("Resetting state & getting new state from backend");
  const userId = appConfig.get().personState.data.userId;
  const syncParams = {
    environmentId: appConfig.get().environmentId,
    apiHost: appConfig.get().apiHost,
    ...(userId && { userId }),
    attributes: appConfig.get().attributes,
  };
  await logoutPerson();
  try {
    await initialize(syncParams);
    return okVoid();
  } catch (e) {
    return err(e as NetworkError);
  }
};
