export class TimeoutStack {
  private static instance: TimeoutStack;
  private timeouts: number[] = [];

  // Private constructor to prevent direct instantiation
  private constructor() {}

  // Retrieve the singleton instance of TimeoutStack
  public static getInstance(): TimeoutStack {
    if (!TimeoutStack.instance) {
      TimeoutStack.instance = new TimeoutStack();
    }
    return TimeoutStack.instance;
  }

  // Add a new timeout ID to the stack
  public add(timeoutId: number): void {
    console.log("Adding timeout ID to stack:", timeoutId);
    this.timeouts.push(timeoutId);
    console.log("Current timeout stack:", this.timeouts);
  }

  // Clear a specific timeout and remove it from the stack
  public remove(timeoutId: number): void {
    clearTimeout(timeoutId);
    this.timeouts = this.timeouts.filter((id) => id !== timeoutId);
  }

  // Clear all timeouts and reset the stack
  public clear(): void {
    for (const timeoutId of this.timeouts) {
      clearTimeout(timeoutId);
    }
    this.timeouts = [];
  }

  // Get the current stack of timeout IDs
  public getTimeouts(): number[] {
    return this.timeouts;
  }
}
