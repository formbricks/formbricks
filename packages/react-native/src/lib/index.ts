import { TJsAppConfigInput } from "@formbricks/types/js";
import { ErrorHandler } from "../../../js-core/src/shared/errors";
import { Logger } from "../../../js-core/src/shared/logger";
import { trackCodeAction } from "./actions";
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
  queue.add<any>(true, "app", trackCodeAction, name, properties);
  await queue.wait();
};
