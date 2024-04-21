import { SurveyInlineProps, SurveyModalProps } from "@formbricks/types/formbricksSurveys";
import { TJsAppConfigInput } from "@formbricks/types/js";

import { CommandQueue } from "../shared/commandQueue";
import { ErrorHandler } from "../shared/errors";
import { Logger } from "../shared/logger";
import { trackAction } from "./lib/actions";
import { getApi } from "./lib/api";
import { initialize } from "./lib/initialize";
import { checkPageUrl } from "./lib/noCodeActions";
import { logoutPerson, resetPerson, setPersonAttribute } from "./lib/person";

declare global {
  interface Window {
    formbricksSurveys: {
      renderSurveyInline: (props: SurveyInlineProps) => void;
      renderSurveyModal: (props: SurveyModalProps) => void;
    };
  }
}

const logger = Logger.getInstance();

logger.debug("Create command queue");
const queue = new CommandQueue();

const init = async (initConfig: TJsAppConfigInput) => {
  ErrorHandler.init(initConfig.errorHandler);
  queue.add(false, "app", initialize, initConfig);
  await queue.wait();
};

const setEmail = async (email: string): Promise<void> => {
  setAttribute("email", email);
  await queue.wait();
};

const setAttribute = async (key: string, value: any): Promise<void> => {
  queue.add(true, "app", setPersonAttribute, key, value);
  await queue.wait();
};

const logout = async (): Promise<void> => {
  queue.add(true, "app", logoutPerson);
  await queue.wait();
};

const reset = async (): Promise<void> => {
  queue.add(true, "app", resetPerson);
  await queue.wait();
};

const track = async (name: string, properties: any = {}): Promise<void> => {
  queue.add<any>(true, "app", trackAction, name, properties);
  await queue.wait();
};

const registerRouteChange = async (): Promise<void> => {
  queue.add(true, "app", checkPageUrl);
  await queue.wait();
};

const formbricks = {
  init,
  setEmail,
  setAttribute,
  track,
  logout,
  reset,
  registerRouteChange,
  getApi,
};

export type TFormbricksApp = typeof formbricks;
export default formbricks as TFormbricksApp;
