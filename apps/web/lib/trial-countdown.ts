const MS_PER_DAY = 86_400_000;

/**
 * Whole days left in a trial, rounded up, or `null` if the stored `trialEnd` isn't a usable date.
 *
 * Lives here rather than in the components that display the count so the clock is read on the
 * server: `Date.now()` during a client render is impure, so the number would differ between the
 * server pass and hydration and then go stale as the tab sits open (ENG-2366).
 *
 * Rounding up means the last partial day still reads as "1 day left" rather than "0"; a trial that
 * has already ended returns zero or a negative number, and callers decide what to show for that.
 */
export const getTrialDaysRemaining = (trialEnd: string | Date): number | null => {
  const trialEndTime = new Date(trialEnd).getTime();
  if (!Number.isFinite(trialEndTime)) {
    return null;
  }
  return Math.ceil((trialEndTime - Date.now()) / MS_PER_DAY);
};
