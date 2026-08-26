import { Config } from "@/lib/common/config";
import { Logger } from "@/lib/common/logger";
import { tearDown } from "@/lib/common/setup";
import { EmbeddedDataStore } from "@/lib/survey/embedded-data";
import { UpdateQueue } from "@/lib/user/update-queue";
import { type ApiErrorResponse, type Result, okVoid } from "@/types/error";

const MAX_USER_ID_LENGTH = 255;

export const setUserId = async (userId: string): Promise<Result<void, ApiErrorResponse>> => {
  const appConfig = Config.getInstance();
  const logger = Logger.getInstance();
  const updateQueue = UpdateQueue.getInstance();

  const {
    data: { userId: currentUserId },
  } = appConfig.get().user;

  // Validate the new userId before mutating any state, so an invalid replacement
  // does not tear down the existing valid user.
  if (userId.length > MAX_USER_ID_LENGTH) {
    logger.error(`UserId exceeds maximum length of ${String(MAX_USER_ID_LENGTH)} characters`);
    return okVoid();
  }

  // If the same userId is already set, no-op
  if (currentUserId === userId) {
    logger.debug("UserId is already set to the same value, skipping");
    return okVoid();
  }

  // If a different userId is set, clean up the previous user state first
  if (currentUserId) {
    logger.debug("Different userId is being set, cleaning up previous user state");
    tearDown();
    // An identity switch: the ambient Embedded Data bag may carry the previous user's context
    // (hashed ids and the like), which must not ride onto the next user's responses. Deliberately
    // not in tearDown() itself — the setup-error teardown is not an identity switch, and page
    // context should survive a setup retry. First-time identification (no currentUserId) keeps the
    // bag too: the host legitimately pushes context before identifying.
    EmbeddedDataStore.getInstance().clearEmbeddedData();
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
    // Same identity-switch rule as setUserId above: logout must not let the previous user's
    // ambient context leak onto whoever uses the page next.
    EmbeddedDataStore.getInstance().clearEmbeddedData();

    return okVoid();
  } catch {
    return { ok: false, error: new Error("Failed to logout") };
  }
};
