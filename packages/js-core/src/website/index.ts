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

type QueuedMethod = {
  prop: string;
  args: unknown[];
};

const _initWithQueue = async (initConfig: TJsWebsiteConfigInput, queuedMethods: QueuedMethod[]) => {
  try {
    await init(initConfig);
  } catch (err) {
    logger.error(`Failed to initialize formbricks: ${err}`);
    return;
  }

  for (const { prop, args } of queuedMethods) {
    if ((formbricks as any)[prop] === undefined || typeof (formbricks as any)[prop] !== "function") {
      logger.error(`Method ${prop} does not exist on formbricks`);
      continue;
    }

    await (formbricks as any)[prop](...args);
  }
};

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
  _initWithQueue,
};

export type TFormbricksWebsite = Omit<typeof formbricks, "_initWithQueue">;
export default formbricks as TFormbricksWebsite;
