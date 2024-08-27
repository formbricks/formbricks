import { type NetworkError, type Result, err, okVoid } from "../../../js-core/src/shared/errors";
import { Logger } from "../../../js-core/src/shared/logger";
import { appConfig } from "./config";
import { deinitalize, initialize } from "./initialize";

const logger = Logger.getInstance();

export const logoutPerson = async (): Promise<void> => {
  await deinitalize();
  await appConfig.resetConfig();
};

export const resetPerson = async (): Promise<Result<void, NetworkError>> => {
  logger.debug("Resetting state & getting new state from backend");
  const syncParams = {
    environmentId: appConfig.get().environmentId,
    apiHost: appConfig.get().apiHost,
    userId: appConfig.get().userId,
    attributes: appConfig.get().state.attributes,
  };
  await logoutPerson();
  try {
    await initialize(syncParams);
    return okVoid();
  } catch (e) {
    return err(e as NetworkError);
  }
};
