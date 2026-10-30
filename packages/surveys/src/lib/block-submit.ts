import { type TResponseData } from "@formbricks/types/responses";

/**
 * An element whose answer is produced when the block is submitted instead of while the respondent
 * edits it. The Signature element is the one user: its PNG is rendered and uploaded on Next, so the
 * answer does not exist yet when the respondent presses the button.
 */
export interface SubmitContributor {
  /**
   * Whether the element holds an answer right now, drawn but not stored yet or already stored. The
   * element is the authority: the survey's own copy of its answer can lag a render behind (a Clear).
   */
  hasAnswer: () => boolean;
  /** Produces the answer for the block's submit. May take a while (an upload); never rejects. */
  resolveAnswer: () => Promise<{ ok: true; data: TResponseData } | { ok: false }>;
}

export type SubmitContributors = ReadonlyMap<string, SubmitContributor>;

/**
 * Stands in for an answer that is pending (drawn, not uploaded) when the block is validated, so a
 * required Signature is not reported empty before its image exists. Never stored or sent.
 */
export const PENDING_ANSWER = "pending";

const isUnanswered = (value: unknown): boolean => value === undefined || value === null || value === "";

/**
 * The block's answers as validation should see them, with each contributing element speaking for itself:
 * an answer that is pending counts as given, and one the element no longer holds (it was just cleared)
 * counts as empty even if the survey still has the old value.
 */
export const answersForValidation = (
  values: TResponseData,
  contributors: SubmitContributors
): TResponseData => {
  let result = values;
  contributors.forEach((contributor, elementId) => {
    if (!contributor.hasAnswer()) {
      if (!isUnanswered(result[elementId])) {
        result = { ...result };
        delete result[elementId];
      }
    } else if (isUnanswered(result[elementId])) {
      result = { ...result, [elementId]: PENDING_ANSWER };
    }
  });
  return result;
};

/**
 * Asks every contributor for its answer, one after another, and stops at the first that fails (it has
 * already shown its own error). Resolves with the merged answers, or the id of the element that failed.
 */
export const resolveContributedAnswers = async (
  contributors: SubmitContributors
): Promise<{ ok: true; data: TResponseData } | { ok: false; failedElementId: string }> => {
  const data: TResponseData = {};
  // A snapshot: a card re-rendering mid-upload re-registers its element, and a live Map iterator would
  // visit that entry again.
  for (const [elementId, contributor] of [...contributors]) {
    const result = await contributor.resolveAnswer();
    if (!result.ok) return { ok: false, failedElementId: elementId };
    Object.assign(data, result.data);
  }
  return { ok: true, data };
};

export interface BlockSubmitRunnerOptions {
  getContributors: () => SubmitContributors;
  /** The block's answers as they are now, read when the contributors have finished. */
  collectResponses: () => TResponseData;
  /** Advances the block with the complete set of answers. */
  onSubmit: (answers: TResponseData) => void;
  /** A contributor failed (it shows its own error); the block stays where it is. */
  onFailure: (failedElementId: string) => void;
  /** Whether a submit is in flight, for locking the buttons. Not called once the block is gone. */
  onBusyChange: (busy: boolean) => void;
  /** False once the respondent has left the card: the answers are no longer wanted. */
  isMounted: () => boolean;
  /** Receives anything `onSubmit` throws, so it is reported rather than left as an unhandled rejection. */
  onError: (error: unknown) => void;
}

/**
 * Runs "upload on Next" for a block: asks the contributors for their answers, then advances once.
 *
 * `run` is safe to call twice in a row, before anything has re-rendered: the in-flight flag is a plain
 * variable, not state, so a second press while the first is running does nothing instead of starting a
 * second upload. The flag is released whatever happens.
 */
export const createBlockSubmitRunner = ({
  getContributors,
  collectResponses,
  onSubmit,
  onFailure,
  onBusyChange,
  isMounted,
  onError,
}: BlockSubmitRunnerOptions): { run: () => boolean } => {
  let inFlight = false;

  const run = (): boolean => {
    if (inFlight) return false;
    inFlight = true;
    onBusyChange(true);

    const contributors = new Map(getContributors());
    void resolveContributedAnswers(contributors)
      .then((contributed) => {
        // The respondent left the card while the upload ran; advancing now would skip a card.
        if (!isMounted()) return;
        if (!contributed.ok) {
          onFailure(contributed.failedElementId);
          return;
        }
        // The contributors speak for their own elements: whatever the survey held for them is replaced.
        const answers = collectResponses();
        contributors.forEach((_, elementId) => {
          delete answers[elementId];
        });
        onSubmit({ ...answers, ...contributed.data });
      })
      .catch(onError)
      .finally(() => {
        inFlight = false;
        if (isMounted()) onBusyChange(false);
      });
    return true;
  };

  return { run };
};
