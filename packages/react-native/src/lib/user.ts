import { type ApiErrorResponse, type NetworkError, type Result, err, okVoid } from "../types/errors";
import { RNConfig } from "./config";
import { deinitalize, initialize } from "./initialize";
import { Logger } from "./logger";
import { UpdateQueue } from "./update-queue";

const appConfig = RNConfig.getInstance();
const logger = Logger.getInstance();
const updateQueue = UpdateQueue.getInstance();

// eslint-disable-next-line @typescript-eslint/require-await -- we want to use promises here
export const setUserIdInApp = async (userId: string): Promise<Result<void, ApiErrorResponse>> => {
  const {
    data: { userId: currentUserId },
  } = appConfig.get().user;

  if (currentUserId) {
    logger.error(
      "A userId is already set in formbricks, please first call the logout function and then set a new userId"
    );
    return err({
      code: "forbidden",
      message: "User already set",
      responseMessage: "User already set",
      status: 403,
    });
  }

  updateQueue.updateUserId(userId);
  void updateQueue.processUpdates();
  return okVoid();
};

// export const setUserIdInApp = async (userId: string): Promise<void> => {
//   // const { apiHost, environmentId, environmentState } = appConfig.get();
//   updateQueue.updateUserId(userId);
//   void updateQueue.processUpdates();
// try {
//   // fetch the person state with the userId
//   // update the local state with the new person state
//   // filter surveys again

//   const personState = await fetchPersonState({
//     apiHost,
//     environmentId,
//     userId,
//   });

//   const filteredSurveys = filterSurveys(environmentState, personState);

//   appConfig.update({
//     ...appConfig.get(),
//     personState,
//     filteredSurveys,
//   });

//   return okVoid();
// } catch (e: unknown) {
//   logger.error(`Error setting userId: ${e as string}`);

//   return err({
//     code: "network_error",
//     message: "Error fetching the person state",
//     responseMessage: "Error fetching the person state",
//     status: 500,
//     url: new URL(`${apiHost}/api/v1/client/${environmentId}/identify/contacts/${userId}`),
//   });
// }
// };

export const logoutUser = async (): Promise<void> => {
  await deinitalize();
};

export const resetUser = async (): Promise<Result<void, NetworkError>> => {
  logger.debug("Resetting state & getting new state from backend");
  const syncParams = {
    environmentId: appConfig.get().environmentId,
    apiHost: appConfig.get().apiHost,
  };

  void logoutUser();
  try {
    await initialize(syncParams);
    return okVoid();
  } catch (e) {
    return err(e as NetworkError);
  }
};
