// Simple queue for formbricks methods

export class MethodQueue {
  private queue: (() => Promise<void>)[] = [];
  private isExecuting = false;

  add = (method: () => Promise<void>) => {
    this.queue.push(method);
    this.run();
  };

  private runNext = async () => {
    if (this.isExecuting) return;

    const method = this.queue.shift();
    if (method) {
      this.isExecuting = true;
      try {
        await method();
      } finally {
        this.isExecuting = false;
        if (this.queue.length > 0) {
          this.runNext();
        }
      }
    }
  };

  run = async () => {
    if (!this.isExecuting && this.queue.length > 0) {
      await this.runNext();
    }
  };

  clear = () => {
    this.queue = [];
  };
}
