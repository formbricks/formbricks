import { okVoid } from "../types/error";
import { UpdateQueue } from "../user/user-update-queue";

const updatesQueue = UpdateQueue.getInstance();

// eslint-disable-next-line @typescript-eslint/require-await -- we want to use promises here
export const setLanguage = async (language: string) => {
  updatesQueue.updateAttributes({ language });
  void updatesQueue.processUpdates();
  return okVoid();
};
