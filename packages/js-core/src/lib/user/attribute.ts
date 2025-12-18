import { Logger } from "@/lib/common/logger";
import { UpdateQueue } from "@/lib/user/update-queue";
import { type NetworkError, type Result, err, okVoid } from "@/types/error";

export const setAttributes = async (
  attributes: Record<string, string>
): Promise<Result<void, NetworkError>> => {
  const logger = Logger.getInstance();
  const updateQueue = UpdateQueue.getInstance();
  updateQueue.updateAttributes(attributes);
  try {
    await updateQueue.processUpdates();
    return okVoid();
  } catch (error) {
    logger.error(
      `Failed to process attribute updates: ${error instanceof Error ? error.message : "Unknown error"}`
    );
    return err({
      code: "network_error",
      message: "Failed to sync attributes",
      responseMessage: error instanceof Error ? error.message : "Unknown error",
      status: 500,
    });
  }
};
