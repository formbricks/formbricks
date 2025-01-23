import { RNConfig } from "../common/config";
import { deinitalize, init } from "../common/initialize";
import { Logger } from "../common/logger";
import { type ApiErrorResponse, type NetworkError, type Result, err, okVoid } from "../types/error";
import { UpdateQueue } from "./user-update-queue";

const appConfig = RNConfig.getInstance();
const logger = Logger.getInstance();
const updateQueue = UpdateQueue.getInstance();

// eslint-disable-next-line @typescript-eslint/require-await -- we want to use promises here
export const setUserId = async (userId: string): Promise<Result<void, ApiErrorResponse>> => {
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

export const logoutUser = async (): Promise<void> => {
  await deinitalize();
};

export const logout = async (): Promise<Result<void, NetworkError>> => {
  logger.debug("Resetting state & getting new state from backend");
  const syncParams = {
    environmentId: appConfig.get().environmentId,
    apiHost: appConfig.get().appUrl;,
  };

  void logoutUser();
  try {
    await init(syncParams);
    return okVoid();
  } catch (e) {
    return err(e as NetworkError);
  }
};
