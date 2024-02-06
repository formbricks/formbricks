import { CommandQueue } from "@formbricks/lib/commandQueue";
import { ErrorHandler } from "@formbricks/lib/errors";
import { Logger } from "@formbricks/lib/logger";
import { TRNConfigInput } from "@formbricks/types/react-native";

import { trackAction } from "./actions";
import { initialize } from "./initialize";

const logger = Logger.getInstance();
logger.debug("Create command queue");
const queue = new CommandQueue();

export const init = async (initConfig: TRNConfigInput) => {
  ErrorHandler.init(initConfig.errorHandler);
  queue.add(false, initialize, initConfig);
  await queue.wait();
};

export const track = async (name: string, properties: any = {}): Promise<void> => {
  queue.add<any>(true, trackAction, name, properties);
  await queue.wait();
};
