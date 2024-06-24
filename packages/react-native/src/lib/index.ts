import { ErrorHandler } from "@formbricks/lib/errors";
import { Logger } from "@formbricks/lib/logger";
import { TJsAppConfigInput } from "@formbricks/types/js";
import { trackAction } from "./actions";
import { CommandQueue } from "./commandQueue";
import { initialize } from "./initialize";

const logger = Logger.getInstance();
logger.debug("Create command queue");
const queue = new CommandQueue();

export const init = async (initConfig: TJsAppConfigInput) => {
  ErrorHandler.init(initConfig.errorHandler);
  queue.add(false, "app", initialize, initConfig);
  await queue.wait();
};

export const track = async (name: string, properties: any = {}): Promise<void> => {
  queue.add<any>(true, "app", trackAction, name, properties);
  await queue.wait();
};
