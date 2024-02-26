import { SurveyInlineProps, SurveyModalProps } from "@formbricks/types/formbricksSurveys";
import { TJsConfigInput } from "@formbricks/types/js";

import { trackAction } from "./lib/actions";
import { getApi } from "./lib/api";
import { CommandQueue } from "./lib/commandQueue";
import { ErrorHandler } from "./lib/errors";
import { initialize } from "./lib/initialize";
import { Logger } from "./lib/logger";
import { checkPageUrl } from "./lib/noCodeActions";
import { logoutPerson, resetPerson, setPersonAttribute, setPersonUserId } from "./lib/person";

declare global {
  interface Window {
    formbricksSurveys: {
      renderSurveyInline: (props: SurveyInlineProps & { brandColor: string }) => void;
      renderSurveyModal: (props: SurveyModalProps & { brandColor: string }) => void;
    };
  }
}

const logger = Logger.getInstance();

logger.debug("Create command queue");
const queue = new CommandQueue();

const init = async (initConfig: TJsConfigInput) => {
  ErrorHandler.init(initConfig.errorHandler);
  queue.add(false, initialize, initConfig);
  await queue.wait();
};

const setUserId = async (): Promise<void> => {
  queue.add(true, setPersonUserId);
  await queue.wait();
};

const setEmail = async (email: string): Promise<void> => {
  setAttribute("email", email);
  await queue.wait();
};

const setAttribute = async (key: string, value: any): Promise<void> => {
  queue.add(true, setPersonAttribute, key, value);
  await queue.wait();
};

const logout = async (): Promise<void> => {
  queue.add(true, logoutPerson);
  await queue.wait();
};

const reset = async (): Promise<void> => {
  queue.add(true, resetPerson);
  await queue.wait();
};

const track = async (name: string, properties: any = {}): Promise<void> => {
  queue.add<any>(true, trackAction, name, properties);
  await queue.wait();
};

const registerRouteChange = async (): Promise<void> => {
  queue.add(true, checkPageUrl);
  await queue.wait();
};

const formbricks = {
  init,
  setUserId,
  setEmail,
  setAttribute,
  track,
  logout,
  reset,
  registerRouteChange,
  getApi,
};

export type FormbricksType = typeof formbricks;
export default formbricks as FormbricksType;
