import { Config } from "./config";
import { Result } from "./errors";

const config = Config.getInstance();

export class CommandQueue {
  private queue: (() => Promise<Result<any, any>>)[] = [];
  private running: boolean = false;
  private errorHandler = config.errorHandler;

  public add(command: () => Promise<any>) {
    this.queue.push(command);
    if (!this.running) {
      this.run();
    }
  }

  private async run() {
    this.running = true;
    while (this.queue.length > 0) {
      const command = this.queue.shift();

      const result = await command();

      if (result.ok !== true) this.errorHandler(result.error);
    }
    this.running = false;
  }
}
