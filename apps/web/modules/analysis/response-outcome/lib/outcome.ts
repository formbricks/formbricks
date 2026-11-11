import type { TResponseOutcome, TResponseStatusFilter } from "@formbricks/types/responses";

/** The most ids `POST /api/v3/responses/batch-outcome` takes in one call. */
export const OUTCOME_BATCH_SIZE = 100;

export type TOutcomeChanges = Record<string, TResponseOutcome | null>;

type TWithOutcome = { id: string; outcome?: TResponseOutcome | null };

/** Splits ids into batches the batch route accepts. Repeats are dropped: the route refuses duplicates. */
export const chunkIds = (ids: string[], size = OUTCOME_BATCH_SIZE): string[][] => {
  const unique = [...new Set(ids)];
  const chunks: string[][] = [];
  for (let start = 0; start < unique.length; start += size) {
    chunks.push(unique.slice(start, start + size));
  }
  return chunks;
};

/** What the rows carry now, kept so a failed request can put it back. */
export const snapshotOutcomes = (rows: TWithOutcome[], ids: string[]): TOutcomeChanges => {
  const wanted = new Set(ids);
  const snapshot: TOutcomeChanges = {};
  for (const row of rows) {
    if (wanted.has(row.id)) snapshot[row.id] = row.outcome ?? null;
  }
  return snapshot;
};

/** Applies outcomes to the named rows. Returns the same array when nothing changes. */
export const patchOutcomes = <T extends TWithOutcome>(rows: T[], changes: TOutcomeChanges): T[] => {
  let changed = false;
  const next = rows.map((row) => {
    if (!(row.id in changes) || (row.outcome ?? null) === changes[row.id]) return row;
    changed = true;
    return { ...row, outcome: changes[row.id] };
  });
  return changed ? next : rows;
};

/**
 * Whether a response is in the list the ticked statuses ask for: in any of them. Complete and Partial follow
 * `finished`, Low quality follows the outcome, so restoring a response can take it out of the list.
 */
export const matchesResponseStatuses = (
  responseStatuses: readonly TResponseStatusFilter[],
  response: { finished: boolean; outcome: TResponseOutcome | null | undefined }
): boolean =>
  responseStatuses.length === 0 ||
  responseStatuses.some((status) => {
    if (status === "complete") return response.finished;
    if (status === "partial") return !response.finished;
    return response.outcome === "lowQuality";
  });

/**
 * The rows left once `ids` have saved `outcome`: a saved row that no longer matches any ticked status leaves
 * the list. Returns the same array when nothing is dropped.
 */
export const dropRowsOutsideStatuses = <T extends { id: string; finished: boolean }>(
  rows: T[],
  ids: readonly string[],
  outcome: TResponseOutcome | null,
  responseStatuses: readonly TResponseStatusFilter[]
): T[] => {
  const kept = rows.filter(
    (row) =>
      !ids.includes(row.id) || matchesResponseStatuses(responseStatuses, { finished: row.finished, outcome })
  );
  return kept.length === rows.length ? rows : kept;
};

/** What the responses page hands down so a card or the selection bar can set an outcome. */
export type TOutcomeActions = {
  /** Patches the page's own response list; also used to roll a refused change back. */
  applyOutcomes: (changes: TOutcomeChanges) => void;
  /** Runs once the server has saved `outcome` for `ids`. */
  onSaved: (ids: string[], outcome: TResponseOutcome | null) => void;
};

/**
 * What the table's Status column says: a response marked Low quality is that, whether or not it was finished;
 * otherwise it is Complete or Not completed (a partial response). `status` is the row's own finished state.
 */
export const responseStatus = (
  status: string,
  outcome: TResponseOutcome | null | undefined
): "complete" | "notCompleted" | "lowQuality" => {
  if (outcome === "lowQuality") return "lowQuality";
  return status === "notCompleted" ? "notCompleted" : "complete";
};
