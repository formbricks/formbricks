/**
 * Why the last auto-save did not land (ENG-2899): `retrying` while the interval keeps running,
 * `stopped` once it has given up -- a stale deployment rejects every action until the tab reloads.
 */
export type TAutoSaveFailure = "retrying" | "stopped";

export interface TAutoSaveBadgeInput {
  isDraft: boolean;
  /** A draft scheduled to publish: the auto-save interval is not running. */
  isScheduled: boolean;
  failure: TAutoSaveFailure | null;
  /** A save landed in the last few seconds. */
  showSaved: boolean;
  /** Whether the editor offers a manual save; CX mode does not. */
  canSaveManually: boolean;
}

export type TAutoSaveBadgeLabel = "disabled" | "paused" | "on" | "saved" | "failed";
export type TAutoSaveBadgeTooltip =
  | "disabled"
  | "paused"
  | "on"
  | "failedRetryingOrSaveManually"
  | "failedRetrying"
  | "failedPaused"
  | "failedStopped";

export interface TAutoSaveBadge {
  tone: "neutral" | "success" | "warning";
  label: TAutoSaveBadgeLabel;
  tooltip: TAutoSaveBadgeTooltip;
  /** Only a failure is announced: the other states change on every save and would be noise. */
  announce: boolean;
}

const failed = (tooltip: TAutoSaveBadgeTooltip): TAutoSaveBadge => ({
  tone: "warning",
  label: "failed",
  tooltip,
  announce: true,
});

/**
 * What the editor's auto-save badge says. Every state carries a tooltip, so the badge is always the
 * same focusable element and never unmounts under a keyboard user. A tooltip only promises what the
 * editor can deliver in that state: retries only while the interval runs, a manual save only where
 * one exists. The component maps these ids to translated strings.
 */
export const getAutoSaveBadge = ({
  isDraft,
  isScheduled,
  failure,
  showSaved,
  canSaveManually,
}: TAutoSaveBadgeInput): TAutoSaveBadge => {
  if (!isDraft) return { tone: "neutral", label: "disabled", tooltip: "disabled", announce: false };

  // A failed save outranks everything else: the author must not be told their work is safe while
  // the latest attempt to save it did not land.
  if (failure === "stopped") return failed("failedStopped");
  if (failure === "retrying") {
    if (isScheduled) return failed("failedPaused");
    return failed(canSaveManually ? "failedRetryingOrSaveManually" : "failedRetrying");
  }

  if (isScheduled) return { tone: "neutral", label: "paused", tooltip: "paused", announce: false };

  return showSaved
    ? { tone: "success", label: "saved", tooltip: "on", announce: false }
    : { tone: "neutral", label: "on", tooltip: "on", announce: false };
};
