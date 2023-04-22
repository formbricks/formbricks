import { Config } from "./config";
import { Result } from "./errors";
import { checkInitialized } from "./init";
import { Logger } from "./logger";

const config = Config.getInstance();
const logger = Logger.getInstance();

export class CommandQueue {
  private queue: {
    command: (args: any) => Promise<Result<any, any>> | Result<any, any>;
    checkInitialized: boolean;
    commandArgs: any[];
  }[] = [];
  private running: boolean = false;
  private errorHandler = config.errorHandler;

  public add<A>(
    checkInitialized: boolean = true,
    command: (...args: A[]) => Promise<Result<any, any>> | Result<any, any>,
    ...args: A[]
  ) {
    logger.debug(`Add command to queue: ${command.name}(${args})`);
    this.queue.push({ command, checkInitialized, commandArgs: args });

    if (!this.running) {
      this.run();
    }
  }

  private async run() {
    this.running = true;
    while (this.queue.length > 0) {
      const currentItem = this.queue.shift();

      // make sure formbricks is initialized
      const initResult = checkInitialized();

      if (initResult.ok !== true) this.errorHandler(initResult.error);

      const result = await currentItem.command(currentItem.commandArgs);

      if (result.ok !== true) this.errorHandler(result.error);
    }
    this.running = false;
  }
}
