import { UpdateQueue } from "@/lib/user/update-queue";
import { type NetworkError, type Result, okVoid } from "@/types/error";

const updateQueue = UpdateQueue.getInstance();

export const setAttributes = async (
  attributes: Record<string, string>
  // eslint-disable-next-line @typescript-eslint/require-await -- we want to use promises here
): Promise<Result<void, NetworkError>> => {
  updateQueue.updateAttributes(attributes);
  void updateQueue.processUpdates();
  return okVoid();
};
