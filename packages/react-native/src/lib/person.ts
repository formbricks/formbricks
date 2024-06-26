import { NetworkError, Result, err, okVoid } from "@formbricks/lib/errors";
import { RNAppConfig } from "@formbricks/lib/js/config";
import { Logger } from "@formbricks/lib/logger";
import { deinitalize, initialize } from "./initialize";

const appConfig = RNAppConfig.getInstance();
const logger = Logger.getInstance();

export const logoutPerson = async (): Promise<void> => {
  deinitalize();
  appConfig.resetConfig();
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
