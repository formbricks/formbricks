import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { setup, tearDown } from "@/lib/common/setup";
import { UpdateQueue } from "@/lib/user/update-queue";
import { type ApiErrorResponse, type NetworkError, type Result, err, okVoid } from "@/types/error";

// eslint-disable-next-line @typescript-eslint/require-await -- we want to use promises here
export const setUserId = async (userId: string): Promise<Result<void, ApiErrorResponse>> => {
  const appConfig = Config.getInstance();
  const logger = Logger.getInstance();
  const updateQueue = UpdateQueue.getInstance();

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

export const logout = async (): Promise<Result<void, NetworkError>> => {
  const logger = Logger.getInstance();
  const appConfig = Config.getInstance();

  const { userId } = appConfig.get().user.data;

  if (!userId) {
    logger.error("No userId is set, please use the setUserId function to set a userId first");
    return okVoid();
  }

  logger.debug("Resetting state & getting new state from backend");
  const initParams = {
    environmentId: appConfig.get().environmentId,
    appUrl: appConfig.get().appUrl,
  };

  // logout the user, remove user state and setup formbricks again
  tearDown();

  try {
    await setup(initParams);
    return okVoid();
  } catch (e) {
    const errorTyped = e as { message?: string };
    logger.error(`Failed to setup formbricks after logout: ${errorTyped.message ?? "Unknown error"}`);
    return err(e as NetworkError);
  }
};
