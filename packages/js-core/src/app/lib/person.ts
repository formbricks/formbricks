import { NetworkError, Result, err, okVoid } from "../../shared/errors";
import { Logger } from "../../shared/logger";
import { AppConfig } from "./config";
import { deinitalize, initialize } from "./initialize";
import { closeSurvey } from "./widget";

const appConfig = AppConfig.getInstance();
const logger = Logger.getInstance();

export const logoutPerson = async (): Promise<void> => {
  deinitalize();
  appConfig.resetConfig();
};

export const resetPerson = async (): Promise<Result<void, NetworkError>> => {
  logger.debug("Resetting state & getting new state from backend");
  closeSurvey();

  const userId = appConfig.get().personState.data.userId;
  if (!userId) {
    return err({
      code: "network_error",
      status: 500,
      message: "Missing userId",
      url: `${appConfig.get().apiHost}/api/v1/client/${appConfig.get().environmentId}/people/${userId}/attributes`,
      responseMessage: "Missing userId",
    });
  }

  const syncParams = {
    environmentId: appConfig.get().environmentId,
    apiHost: appConfig.get().apiHost,
    userId,
    attributes: appConfig.get().personState.data.attributes,
  };
  await logoutPerson();
  try {
    await initialize(syncParams);
    return okVoid();
  } catch (e) {
    return err(e as NetworkError);
  }
};
