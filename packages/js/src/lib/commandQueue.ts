import { Config } from "./config";
import { Result } from "./errors";
import { checkInitialized } from "./init";
import { Logger } from "./logger";

const config = Config.getInstance();
const logger = Logger.getInstance();

export class CommandQueue {
  private queue: {
    command: (args: any) => Promise<Result<void, any>> | Result<void, any>;
    checkInitialized: boolean;
    commandArgs: any[];
  }[] = [];
  private running: boolean = false;
  private errorHandler = config.errorHandler;

  public add<A>(
    checkInitialized: boolean = true,
    command: (...args: A[]) => Promise<Result<void, any>> | Result<void, any>,
    ...args: A[]
  ) {
    logger.debug(`Add command to queue: ${command.name}(${JSON.stringify(args)})`);
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
      if (currentItem.checkInitialized) {
        const initResult = checkInitialized();

        if (initResult && initResult.ok !== true) this.errorHandler(initResult.error);
      }

      const result = await currentItem.command.apply(null, currentItem.commandArgs);

      logger.debug(
        `Command result: ${result === undefined ? "OK" : "Something went really wrong"}, ${
          currentItem.command.name
        }`
      );

      if (!result) continue;

      if (result.ok !== true) this.errorHandler(result.error);
    }
    this.running = false;
  }
}
