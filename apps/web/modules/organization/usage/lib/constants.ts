/**
 * Member activity bands (ENG-3317). A member is active after a sign-in within the last `ACTIVE_DAYS`, and
 * dormant with no sign-in for `DORMANT_DAYS` or more — a `null` last sign-in counts as dormant, because the
 * column was never backfilled. The gap in between belongs to neither band, so the counts do not add up to
 * the total by design.
 */
export const ACTIVE_MEMBER_DAYS = 30;
export const DORMANT_MEMBER_DAYS = 90;
