export class TimeoutStack {
  private static instance: TimeoutStack | null = null;
  private timeouts: { event: string; timeoutId: number }[] = [];

  // eslint-disable-next-line @typescript-eslint/no-empty-function -- Empty constructor is intentional
  private constructor() {}

  // Retrieve the singleton instance of TimeoutStack
  public static getInstance(): TimeoutStack {
    if (!TimeoutStack.instance) {
      TimeoutStack.instance = new TimeoutStack();
    }
    return TimeoutStack.instance;
  }

  // Add a new timeout ID to the stack
  public add(event: string, timeoutId: number): void {
    this.timeouts.push({ event, timeoutId });
  }

  // Clear a specific timeout and remove it from the stack
  public remove(timeoutId: number): void {
    clearTimeout(timeoutId);
    this.timeouts = this.timeouts.filter((timeout) => timeout.timeoutId !== timeoutId);
  }

  // Clear all timeouts and reset the stack
  public clear(): void {
    for (const timeout of this.timeouts) {
      clearTimeout(timeout.timeoutId);
    }
    this.timeouts = [];
  }

  // Get the current stack of timeout IDs
  public getTimeouts(): {
    event: string;
    timeoutId: number;
  }[] {
    return this.timeouts;
  }
}
