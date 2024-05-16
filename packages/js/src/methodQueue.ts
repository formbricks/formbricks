// Simple queue for formbricks methods

export class MethodQueue {
  private queue: (() => Promise<void>)[] = [];

  add = (method: () => Promise<void>) => {
    this.queue.push(method);
  };

  run = async () => {
    for (const method of this.queue) {
      await method();
    }
  };

  clear = () => {
    this.queue = [];
  };
}
