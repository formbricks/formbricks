import { SurveyInlineProps, SurveyModalProps } from "@formbricks/types/formbricksSurveys";
import { TJsConfigInput } from "@formbricks/types/js";

import { trackAction } from "./lib/actions";
import { getApi } from "./lib/api";
import { CommandQueue } from "./lib/commandQueue";
import { Config } from "./lib/config";
import { ErrorHandler } from "./lib/errors";
import { initialize } from "./lib/initialize";
import { Logger } from "./lib/logger";
import { checkPageUrl } from "./lib/noCodeActions";
import { logoutPerson, resetPerson, setPersonAttribute, setPersonUserId } from "./lib/person";
import { renderWidget } from "./lib/widget";

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

/**
 * Show survey modal
 * Please note: ignores normal actions/triggers & displayPercentage
 * survey delay will be taken into account
 *
 * @param uuid: uuid of the survey (status has to be in-progress)
 */
const renderSurveyModal = async (uuid: string): Promise<void> => {
  const survey = Config.getInstance()
    .get()
    .state.surveys.find((s) => s.id === uuid);
  if (!survey) {
    logger.error(`Survey with uuid ${uuid} not found`);
    return;
  }
  queue.add(true, renderWidget, survey);
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
  renderSurveyModal,
};

export type FormbricksType = typeof formbricks;
export default formbricks as FormbricksType;
