import { TJsTrackProperties, TJsWebsiteConfigInput } from "@formbricks/types/js";
// Shared imports
import { CommandQueue } from "../shared/commandQueue";
import { ErrorHandler } from "../shared/errors";
import { Logger } from "../shared/logger";
// Website package specific imports
import { trackCodeAction } from "./lib/actions";
import { resetConfig } from "./lib/common";
import { initialize } from "./lib/initialize";
import { checkPageUrl } from "./lib/noCodeActions";

const logger = Logger.getInstance();

logger.debug("Create command queue");
const queue = new CommandQueue();

const init = async (initConfig: TJsWebsiteConfigInput) => {
  ErrorHandler.init(initConfig.errorHandler);
  queue.add(false, "website", initialize, initConfig);
  await queue.wait();
};

const reset = async (): Promise<void> => {
  queue.add(true, "website", resetConfig);
  await queue.wait();
};

const track = async (name: string, properties?: TJsTrackProperties): Promise<void> => {
  queue.add<any>(true, "website", trackCodeAction, name, properties);
  await queue.wait();
};

const registerRouteChange = async (): Promise<void> => {
  queue.add(true, "website", checkPageUrl);
  await queue.wait();
};

const formbricks = {
  init,
  track,
  reset,
  registerRouteChange,
};

export type TFormbricksWebsite = typeof formbricks;
export default formbricks as TFormbricksWebsite;
