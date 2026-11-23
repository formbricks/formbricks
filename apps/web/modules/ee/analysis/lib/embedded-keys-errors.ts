/**
 * Why a query's embedded-data keys were refused. Kept apart from `dataset-embedded-keys` so the v3 error
 * mapper can answer them without loading the key catalog. Both messages are fixed and name no key.
 */

/**
 * A query names rarer embedded keys of more than one bucket. One token carries one bucket: carrying the
 * union would compile a model per combination of buckets, which dashboard picks could multiply at will.
 */
export class RareEmbeddedKeysConflictError extends Error {
  constructor() {
    super(
      "The query uses rarely used embedded-data fields that cannot be combined in one chart. Remove one of them."
    );
    this.name = "RareEmbeddedKeysConflictError";
  }
}

/**
 * A query names embedded keys the dataset's key catalog has not caught up with, and refreshing it failed:
 * the keys are new, not rare, so the caller is told to wait rather than to remove one.
 */
export class EmbeddedKeysNotReadyError extends Error {
  constructor() {
    super("Some embedded-data fields in this chart are not available yet. Try again in a few minutes.");
    this.name = "EmbeddedKeysNotReadyError";
  }
}
