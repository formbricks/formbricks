/**
 * The Low quality flag a rule raises (ENG-6933, P42). The survey sends `markLowQuality: true` once per
 * response, with the write after the rule first fires. Sent again — after Back and a second submit
 * of the same block, or after an offline session resumes — it would undo a reviewer's restore made
 * while the respondent is still answering.
 */
export interface TLowQualityFlag {
  /** A rule fired and the next write has not carried the flag yet. */
  pending: boolean;
  /** A write already carried the flag for this response. */
  sent: boolean;
}

export const INITIAL_LOW_QUALITY_FLAG: TLowQualityFlag = { pending: false, sent: false };

/** A rule fired: the next write carries the flag, unless one already did. */
export const raiseLowQualityFlag = (flag: TLowQualityFlag): TLowQualityFlag =>
  flag.sent ? flag : { ...flag, pending: true };

/** Whether this write carries the flag, and the state after it. */
export const takeLowQualityFlag = (flag: TLowQualityFlag): { send: boolean; next: TLowQualityFlag } =>
  flag.pending && !flag.sent
    ? { send: true, next: { pending: false, sent: true } }
    : { send: false, next: flag };
