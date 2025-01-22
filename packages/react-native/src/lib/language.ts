import { okVoid } from "../types/errors";
import { UpdateQueue } from "./update-queue";

const updatesQueue = UpdateQueue.getInstance();

// eslint-disable-next-line @typescript-eslint/require-await -- we want to use promises here
export const setLanguageInApp = async (language: string) => {
  updatesQueue.updateLanguage(language);
  void updatesQueue.processUpdates();
  return okVoid();
};
