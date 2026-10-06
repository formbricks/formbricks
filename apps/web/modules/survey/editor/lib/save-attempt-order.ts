/**
 * Orders the outcomes of save attempts by when each attempt *started* (ENG-2899).
 *
 * Saves in the survey editor can overlap: the 10-second auto-save tick skips while a manual save is
 * in flight, but a manual save can start while a tick is in flight. Next.js mostly settles them in
 * start order, because it sends server actions one at a time -- except that a navigation discards the
 * pending action and lets the next queued one start while the discarded request is still in flight
 * (`app-router-instance.js`), and the docs call one-at-a-time "an implementation detail [that] may
 * change". If a newer attempt settles first, whatever settles last must not decide what the save
 * indicator says: an old auto-save landing after a newer save failed would report "Progress saved"
 * over work that is not saved, and an old one failing after a newer save landed would report "Changes
 * not saved" over work that is.
 *
 * `begin()` hands out a number when an attempt starts; `settle(attempt)` reports whether that
 * attempt's outcome is still the newest one known and, if so, records it. Only the indicator is
 * gated: what the server returned is still applied, because the server really did store it.
 */
export interface SaveAttemptOrder {
  begin: () => number;
  /** False when a newer attempt has already settled, so this outcome is stale for the indicator. */
  settle: (attempt: number) => boolean;
}

export const createSaveAttemptOrder = (): SaveAttemptOrder => {
  let started = 0;
  let newestSettled = 0;

  return {
    begin: () => {
      started += 1;
      return started;
    },
    settle: (attempt) => {
      if (attempt < newestSettled) return false;
      newestSettled = attempt;
      return true;
    },
  };
};
