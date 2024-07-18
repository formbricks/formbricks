// Simple queue for formbricks methods

export class MethodQueue {
  private queue: (() => Promise<unknown>)[] = [];
  private isExecuting = false;

  add = (method: () => Promise<unknown>): void => {
    this.queue.push(method);
    void this.run();
  };

  private runNext = async (): Promise<void> => {
    if (this.isExecuting) return;

    const method = this.queue.shift();
    if (method) {
      this.isExecuting = true;
      try {
        await method();
      } finally {
        this.isExecuting = false;
        if (this.queue.length > 0) {
          void this.runNext();
        }
      }
    }
  };

  run = async (): Promise<void> => {
    if (!this.isExecuting && this.queue.length > 0) {
      await this.runNext();
    }
  };

  clear = (): void => {
    this.queue = [];
  };
}
