import { type TJsAppConfigInput } from "@formbricks/types/js";
import { ErrorHandler } from "../../../js-core/src/shared/errors";
import { Logger } from "../../../js-core/src/shared/logger";
import { trackCodeAction } from "./actions";
import { CommandQueue } from "./command-queue";
import { initialize } from "./initialize";

const logger = Logger.getInstance();
logger.debug("Create command queue");
const queue = new CommandQueue();

export const init = async (initConfig: TJsAppConfigInput): Promise<void> => {
  ErrorHandler.init(initConfig.errorHandler);
  queue.add("app", initialize, false, initConfig);
  await queue.wait();
};

export const track = async (name: string, properties = {}): Promise<void> => {
  queue.add<any>("app", trackCodeAction, true, name, properties);
  await queue.wait();
};
