import { type NetworkError } from "@formbricks/types/errors";
import { type Result, err, okVoid } from "../../../js-core/src/lib/errors";
import { Logger } from "../../../js-core/src/lib/logger";
import { filterSurveys } from "../../../js-core/src/lib/utils";
import { RNConfig } from "./config";
import { deinitalize, initialize } from "./initialize";
import { fetchPersonState } from "./person-state";

const appConfig = RNConfig.getInstance();
const logger = Logger.getInstance();

export const setUserIdInApp = async (userId: string): Promise<Result<void, NetworkError>> => {
  const { apiHost, environmentId, environmentState } = appConfig.get();
  try {
    // fetch the person state with the userId
    // update the local state with the new person state
    // filter surveys again

    const personState = await fetchPersonState({
      apiHost,
      environmentId,
      userId,
    });

    const filteredSurveys = filterSurveys(environmentState, personState);

    appConfig.update({
      ...appConfig.get(),
      personState,
      filteredSurveys,
    });

    return okVoid();
  } catch (e: unknown) {
    logger.error(`Error setting userId: ${e as string}`);

    return err({
      code: "network_error",
      message: "Error fetching the person state",
      responseMessage: "Error fetching the person state",
      status: 500,
      url: new URL(`${apiHost}/api/v1/client/${environmentId}/identify/contacts/${userId}`),
    });
  }
};

export const logoutPerson = async (): Promise<void> => {
  await deinitalize();
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
