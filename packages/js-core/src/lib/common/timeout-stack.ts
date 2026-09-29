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
    // Two kinds of entry are retired here, and both would otherwise mislead a later lookup:
    //   - One holding this id. `markFired` and `remove` each resolve an entry by `timeoutId`, so a
    //     duplicate makes `markFired` mark the older one and leave the live survey's entry looking
    //     pending. A browser may hand out an id again once its timeout has run, so this is possible.
    //   - This action's spent entry. Nothing reads it once the action schedules again, and keeping
    //     it grows the stack for the lifetime of the page — one entry per survey ever rendered.
    this.timeouts = this.timeouts.filter(
      (timeout) => timeout.timeoutId !== timeoutId && (timeout.event !== event || !timeout.fired)
    );
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
