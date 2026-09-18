/**
 * One entry per survey that an action has scheduled.
 *
 * `fired` is the whole point of this type. A pending entry means "a survey is waiting out its delay
 * and nothing is on screen yet", which is what makes cancelling it safe. Once the timeout runs the
 * entry is spent: the survey is visible, and treating it as cancellable would release the
 * `isSurveyRunning` guard underneath a live survey (ENG-2849).
 */
export interface TScheduledTimeout {
  event: string;
  timeoutId: number;
  fired: boolean;
}

export class TimeoutStack {
  private static instance: TimeoutStack | null = null;
  private timeouts: TScheduledTimeout[] = [];

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
    // Drop this action's spent entry, if any. Nothing reads a fired entry once its action schedules
    // again, and without this the stack grows for the lifetime of the page — one entry per survey
    // ever rendered — leaving several same-named entries for a lookup that expects one.
    this.timeouts = this.timeouts.filter((timeout) => timeout.event !== event || !timeout.fired);
    this.timeouts.push({ event, timeoutId, fired: false });
  }

  // Mark a timeout as fired: its survey is on screen, so it can no longer be cancelled
  public markFired(timeoutId: number): void {
    const timeout = this.timeouts.find((t) => t.timeoutId === timeoutId);
    if (timeout) {
      timeout.fired = true;
    }
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
  public getTimeouts(): TScheduledTimeout[] {
    return this.timeouts;
  }
}
