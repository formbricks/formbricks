import { UpdateQueue } from "@/lib/user/update-queue";
import { type NetworkError, type Result, okVoid } from "@/types/error";

export const setAttributes = async (
  attributes: Record<string, string | Date>
  // eslint-disable-next-line @typescript-eslint/require-await -- we want to use promises here
): Promise<Result<void, NetworkError>> => {
  // Convert Date objects to ISO strings
  const normalizedAttributes: Record<string, string> = {};
  for (const [key, value] of Object.entries(attributes)) {
    normalizedAttributes[key] = value instanceof Date ? value.toISOString() : value;
  }

  const updateQueue = UpdateQueue.getInstance();
  updateQueue.updateAttributes(normalizedAttributes);
  void updateQueue.processUpdates();
  return okVoid();
};
