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

/**
 * The flag as the survey loads: raised when a rule before the first question marked the response
 * (ENG-6952), so it rides on the response's first write, a screen-out's finished response included.
 */
export const startLowQualityFlag = (markedBeforeFirstQuestion: boolean): TLowQualityFlag =>
  markedBeforeFirstQuestion ? raiseLowQualityFlag(INITIAL_LOW_QUALITY_FLAG) : INITIAL_LOW_QUALITY_FLAG;

/**
 * The flag of a session resumed from offline progress: exactly what that session saved. Its rules
 * before the first question ran when it began, and their flag went with its first write, which saved
 * progress records; what they decided on this load is not applied, like the rest of their outcome.
 */
export const resumeLowQualityFlag = (lowQualitySent: boolean | undefined): TLowQualityFlag =>
  lowQualitySent ? { pending: false, sent: true } : INITIAL_LOW_QUALITY_FLAG;

/** Whether this write carries the flag, and the state after it. */
export const takeLowQualityFlag = (flag: TLowQualityFlag): { send: boolean; next: TLowQualityFlag } =>
  flag.pending && !flag.sent
    ? { send: true, next: { pending: false, sent: true } }
    : { send: false, next: flag };
