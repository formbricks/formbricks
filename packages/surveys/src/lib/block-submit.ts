import { type TResponseData } from "@formbricks/types/responses";

/** What a contributor's answer turned out to be: its data for the block, or a failure it has already shown. */
export type ContributedAnswer = { ok: true; data: TResponseData } | { ok: false };

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
  /**
   * Freezes what the element holds at this moment, the same moment the block was validated, and returns
   * what produces the answer from that frozen state. Whatever the respondent does to the element while
   * the answer is being produced (an upload takes seconds) does not change what is submitted. The
   * returned function may take a while; it never rejects.
   */
  capture: () => () => Promise<ContributedAnswer>;
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
 * Asks every captured contributor for its answer, one after another, and stops at the first that fails
 * (it has already shown its own error). Resolves with the merged answers, or the id of the element that failed.
 */
export const resolveContributedAnswers = async (
  captured: ReadonlyMap<string, () => Promise<ContributedAnswer>>
): Promise<{ ok: true; data: TResponseData } | { ok: false; failedElementId: string }> => {
  const data: TResponseData = {};
  for (const [elementId, resolveAnswer] of captured) {
    const result = await resolveAnswer();
    if (!result.ok) return { ok: false, failedElementId: elementId };
    Object.assign(data, result.data);
  }
  return { ok: true, data };
};

export interface BlockSubmitRunnerOptions {
  getContributors: () => SubmitContributors;
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
 * What is submitted is what was validated. `run` takes the block's answers as they stood when validation
 * passed and freezes every contributor at the same moment; nothing is read from the live survey after the
 * upload, so an edit made while it runs (another field cleared, a second Signature redrawn) can neither
 * change the submit nor make it fail the server's validation. The contributors' own answers replace
 * whatever the snapshot held for their elements.
 *
 * `run` is safe to call twice in a row, before anything has re-rendered: the in-flight flag is a plain
 * variable, not state, so a second press while the first is running does nothing instead of starting a
 * second upload. The flag is released whatever happens.
 */
export const createBlockSubmitRunner = ({
  getContributors,
  onSubmit,
  onFailure,
  onBusyChange,
  isMounted,
  onError,
}: BlockSubmitRunnerOptions): { run: (validatedAnswers: TResponseData) => boolean } => {
  let inFlight = false;

  const run = (validatedAnswers: TResponseData): boolean => {
    if (inFlight) return false;
    inFlight = true;
    onBusyChange(true);

    // A card re-rendering mid-upload re-registers its element in the live map; the snapshot is unaffected.
    const captured = new Map<string, () => Promise<ContributedAnswer>>();
    const snapshot = { ...validatedAnswers };
    try {
      getContributors().forEach((contributor, elementId) => {
        captured.set(elementId, contributor.capture());
        delete snapshot[elementId];
      });
    } catch (error) {
      inFlight = false;
      onBusyChange(false);
      onError(error);
      return true;
    }

    void resolveContributedAnswers(captured)
      .then((contributed) => {
        // The respondent left the card while the upload ran; advancing now would skip a card.
        if (!isMounted()) return;
        if (!contributed.ok) {
          onFailure(contributed.failedElementId);
          return;
        }
        onSubmit({ ...snapshot, ...contributed.data });
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
