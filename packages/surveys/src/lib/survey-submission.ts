interface CardVisit {
  readonly blockId: string;
}

/**
 * Stacked cards outlive navigation. Accept input only from the active visit and its own block,
 * and allow only one submission while asynchronous preparation (such as reCAPTCHA) is running.
 * A visit is an identity, so leaving and returning to the same block cannot revive an old handler.
 */
export const createSurveySubmissionGuard = (initialBlockId: string) => {
  let current: CardVisit = { blockId: initialBlockId };
  let inFlight = false;

  const isCurrent = (visit: CardVisit, sourceBlockId: string): boolean =>
    visit === current && sourceBlockId === current.blockId;

  return {
    get current() {
      return current;
    },
    navigate(blockId: string): CardVisit {
      current = { blockId };
      inFlight = false;
      return current;
    },
    isCurrent,
    begin(visit: CardVisit, sourceBlockId: string): (() => void) | undefined {
      if (!isCurrent(visit, sourceBlockId) || inFlight) return undefined;
      inFlight = true;
      return () => {
        // A late completion must not unlock a submission started on a newer visit.
        if (visit === current) inFlight = false;
      };
    },
  };
};
