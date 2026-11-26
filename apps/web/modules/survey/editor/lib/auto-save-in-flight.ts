/**
 * The auto-save tick in flight, if any, so a manual save, publish or schedule can wait it out first.
 *
 * Saves are plain requests and overlap: the tick skips while a manual save is running, but a manual save
 * can start while a tick is in flight. The server then applies whichever request it handles last, so a tick
 * carrying an older draft can land after a newer Save and overwrite it, with the author gone. The
 * `updatedAt` compare-and-set stops a tick reverting a publish, not overwriting a draft save. Waiting the
 * tick out puts the manual save after it.
 *
 * Every run is chained, not just the latest: a tick's request can outlive the 10 s interval, and the tick
 * that fires meanwhile returns at once (it skips while one is in flight), so a single slot would hold that
 * resolved promise and let a save through while the older request is still running.
 */
export interface AutoSaveInFlight {
  /** Record a tick's run. Its failure is the tick's own business: `settled()` never rejects. */
  track: (run: Promise<unknown>) => void;
  /** Resolves once every tracked tick has settled, at once when none is in flight. */
  settled: () => Promise<void>;
}

export const createAutoSaveInFlight = (): AutoSaveInFlight => {
  let inFlight: Promise<void> = Promise.resolve();

  return {
    track: (run) => {
      inFlight = Promise.allSettled([inFlight, run]).then(() => undefined);
    },
    settled: () => inFlight,
  };
};
