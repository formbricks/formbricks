import type { TResponseOutcome } from "@formbricks/types/responses";

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

/** Restoring while the list is filtered to Low quality takes the row out of what the filter selects. */
export const shouldDropAfterOutcome = (
  responseStatus: "all" | "complete" | "partial" | "lowQuality",
  outcome: TResponseOutcome | null
): boolean => responseStatus === "lowQuality" && outcome === null;

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
