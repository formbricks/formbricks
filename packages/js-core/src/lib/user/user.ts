import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { tearDown } from "@/lib/common/setup";
import { UpdateQueue } from "@/lib/user/update-queue";
import { type ApiErrorResponse, type Result, okVoid } from "@/types/error";

// eslint-disable-next-line @typescript-eslint/require-await -- we want to use promises here
export const setUserId = async (userId: string): Promise<Result<void, ApiErrorResponse>> => {
  const appConfig = Config.getInstance();
  const logger = Logger.getInstance();
  const updateQueue = UpdateQueue.getInstance();

  const {
    data: { userId: currentUserId },
  } = appConfig.get().user;

  // If the same userId is already set, no-op
  if (currentUserId === userId) {
    logger.debug("UserId is already set to the same value, skipping");
    return okVoid();
  }

  // If a different userId is set, clean up the previous user state first
  if (currentUserId) {
    logger.debug("Different userId is being set, cleaning up previous user state");
    tearDown();
  }

  updateQueue.updateUserId(userId);
  void updateQueue.processUpdates();
  return okVoid();
};

export const logout = (): Result<void> => {
  try {
    const logger = Logger.getInstance();

    logger.debug("Logging out and cleaning user state");
    tearDown();

    return okVoid();
  } catch {
    return { ok: false, error: new Error("Failed to logout") };
  }
};
