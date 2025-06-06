import { UpdateQueue } from "@/lib/user/update-queue";
import { type NetworkError, type Result, okVoid } from "@/types/error";

export const setAttributes = async (
  attributes: Record<string, string>
  // eslint-disable-next-line @typescript-eslint/require-await -- we want to use promises here
): Promise<Result<void, NetworkError>> => {
  const updateQueue = UpdateQueue.getInstance();
  updateQueue.updateAttributes(attributes);
  void updateQueue.processUpdates();
  return okVoid();
};
