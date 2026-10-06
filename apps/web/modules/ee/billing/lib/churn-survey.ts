export const CHURN_SURVEY_PENDING_KEY = "churnSurveyPending";
export const SUBSCRIPTION_CANCELLED_EVENT = "subscription_cancelled";

type TTrack = (event: string) => Promise<unknown>;
type TMarkerStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * What a plan change to Hobby does about the churn-survey event, by the mode the server reports:
 * - `track-now`: the page stays up, so the SDK has time to deliver the event;
 * - `defer-until-reload`: an immediate (trial) downgrade ends in a full page reload that would
 *   interrupt a queued event, so a marker is left for `FormbricksProvider` to consume after it;
 * - `none`: not a downgrade to Hobby.
 */
export type TChurnSignal = "track-now" | "defer-until-reload" | "none";

export const getHobbyDowngradeChurnSignal = (plan: string, mode: string | undefined): TChurnSignal => {
  if (plan !== "hobby") return "none";
  return mode === "immediate" ? "defer-until-reload" : "track-now";
};

/** Fire-and-forget: a failed delivery must not turn a successful plan change into an error. */
export const trackSubscriptionCancelled = (track: TTrack): Promise<void> =>
  track(SUBSCRIPTION_CANCELLED_EVENT).then(
    () => undefined,
    () => undefined
  );

/**
 * Leave the one-shot marker for the post-reload event. Its value is the user who requested the
 * downgrade, so a logout/login in the same tab before it is consumed cannot attribute the
 * cancellation to whoever is signed in when it fires.
 */
export const markChurnSurveyPending = (storage: TMarkerStorage | undefined, userId: string): void => {
  storage?.setItem(CHURN_SURVEY_PENDING_KEY, userId);
};

/**
 * Send the deferred event if the marker names `userId`, then clear it.
 *
 * - `inFlight` guards a second run (the setup effect's deps changing mid-flight) from reading and
 *   tracking the same marker before the first run has cleared it.
 * - The marker is cleared only after `track` resolves, so a rejection leaves it for the next run.
 * - Clearing is compare-and-delete: a newer cancellation may have overwritten the marker while
 *   `track` was pending, and that one is not consumed yet.
 */
export const consumeChurnSurveyMarker = async ({
  storage,
  userId,
  track,
  inFlight,
}: {
  storage: TMarkerStorage | undefined;
  userId: string;
  track: TTrack;
  inFlight: { current: boolean };
}): Promise<void> => {
  const pendingFor = storage?.getItem(CHURN_SURVEY_PENDING_KEY);
  if (pendingFor !== userId || inFlight.current) return;

  inFlight.current = true;
  try {
    await track(SUBSCRIPTION_CANCELLED_EVENT);
    if (storage?.getItem(CHURN_SURVEY_PENDING_KEY) === pendingFor) {
      storage.removeItem(CHURN_SURVEY_PENDING_KEY);
    }
  } finally {
    inFlight.current = false;
  }
};
