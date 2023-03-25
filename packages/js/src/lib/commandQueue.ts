export class CommandQueue {
  private queue: (() => Promise<any>)[] = [];
  private running: boolean = false;

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
      try {
        await command();
      } catch (error) {
        console.error(error);
      }
    }
    this.running = false;
  }
}
