/**
 * The diff the change-review view renders: what a pushed document would change, as readable paths with
 * the value before and after. The server computes it (the view only draws it), so the model and every
 * host see the same numbers and a huge document never has to travel to the view twice.
 *
 * Unlike `diffDocuments` in the v3 envelope, which summarises a push for the agent (top-level keys, ids
 * inside an array of blocks), this goes down to the field: `blocks[b1].elements[e1].headline.default`.
 * Arrays whose members all carry a string `id` (blocks, elements, endings, workflow nodes) are matched by
 * id, so inserting a block shows one addition, not every following block as changed.
 */

export type TDocumentChangeKind = "added" | "removed" | "changed";

export type TDocumentChange = {
  path: string;
  kind: TDocumentChangeKind;
  before?: unknown;
  after?: unknown;
  destructive?: boolean;
  reason?: string;
};

/** A value longer than this (as text) is cut and marked, so one large block cannot flood the result. */
export const MAX_VALUE_CHARACTERS = 400;
/** The most changes a review lists; the rest are counted, never silently dropped. */
export const MAX_LISTED_CHANGES = 100;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Equality by content: key order does not count, array order does. */
export const isSameValue = (left: unknown, right: unknown): boolean => {
  if (left === right) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((item, index) => isSameValue(item, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined);
    const rightKeys = Object.keys(right).filter((key) => right[key] !== undefined);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key) => key in right && isSameValue(left[key], right[key]))
    );
  }
  return false;
};

type TIdentified = Record<string, unknown> & { id: string };

const isIdentifiedList = (value: unknown): value is TIdentified[] => {
  if (!Array.isArray(value) || value.length === 0) return false;
  const ids = new Set<string>();
  for (const item of value) {
    if (!isPlainObject(item) || typeof item.id !== "string" || ids.has(item.id)) return false;
    ids.add(item.id);
  }
  return true;
};

const childPath = (path: string, key: string): string => (path ? `${path}.${key}` : key);

const walk = (path: string, before: unknown, after: unknown, out: TDocumentChange[]): void => {
  if (isSameValue(before, after)) return;

  if (before === undefined) {
    out.push({ path, kind: "added", after });
    return;
  }
  if (after === undefined) {
    out.push({ path, kind: "removed", before });
    return;
  }

  if (isPlainObject(before) && isPlainObject(after)) {
    // An object that turned into another kind of object (a destination, a node, an element) is replaced,
    // not edited: listing its fields one by one would show half of one thing next to half of another.
    if (typeof before.type === "string" && typeof after.type === "string" && before.type !== after.type) {
      out.push({ path, kind: "changed", before, after });
      return;
    }
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) walk(childPath(path, key), before[key], after[key], out);
    return;
  }

  if (isIdentifiedList(before) && isIdentifiedList(after)) {
    walkIdentifiedList(path, before, after, out);
    return;
  }

  out.push({ path, kind: "changed", before, after });
};

const walkIdentifiedList = (
  path: string,
  before: TIdentified[],
  after: TIdentified[],
  out: TDocumentChange[]
): void => {
  const previous = new Map(before.map((item) => [item.id, item]));
  const next = new Map(after.map((item) => [item.id, item]));

  for (const item of after) {
    const old = previous.get(item.id);
    if (old) walk(`${path}[${item.id}]`, old, item, out);
    else out.push({ path: `${path}[${item.id}]`, kind: "added", after: item });
  }
  for (const item of before) {
    if (!next.has(item.id)) out.push({ path: `${path}[${item.id}]`, kind: "removed", before: item });
  }

  // The members that stayed, in a different order: every id matched above, but the list still changed.
  const keptBefore = before.filter((item) => next.has(item.id)).map((item) => item.id);
  const keptAfter = after.filter((item) => previous.has(item.id)).map((item) => item.id);
  if (!isSameValue(keptBefore, keptAfter)) {
    out.push({ path, kind: "changed", before: keptBefore, after: keptAfter });
  }
};

/** Every difference between two documents, in document order (keys sorted, lists in their new order). */
export const diffDocumentValues = (before: unknown, after: unknown): TDocumentChange[] => {
  const out: TDocumentChange[] = [];
  walk("", before, after, out);
  return out;
};

const truncationMarker = (length: number): string => `…[truncated, ${length} characters]`;

/** A value as the result carries it: short ones as they are, long ones as a marked text preview. */
export const limitValue = (value: unknown): unknown => {
  if (value === undefined) return undefined;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  if (text.length <= MAX_VALUE_CHARACTERS) return value;
  return `${text.slice(0, MAX_VALUE_CHARACTERS)}${truncationMarker(text.length)}`;
};

export type TDestructiveChange = {
  type: string;
  ids?: string[];
  responseCount?: number;
};

export type TDestructiveSummary = {
  type: string;
  ids: string[];
  responseCount?: number;
  /** What would go, as a noun phrase that completes "I understand this removes …". */
  removes: string;
  /** Why it matters, one sentence. */
  detail: string;
};

const plural = (count: number, one: string, many: string): string => `${count} ${count === 1 ? one : many}`;

const ANSWERS_DETAIL = "Their answers stay stored but no longer show in any result view.";

const blocksDetail = (responseCount: number | undefined): string =>
  responseCount
    ? `The survey has ${plural(responseCount, "response", "responses")}. ${ANSWERS_DETAIL}`
    : ANSWERS_DETAIL;

/** The reviewable wording of one destructive change the push refused with. */
export const describeDestructiveChange = (change: TDestructiveChange): TDestructiveSummary => {
  const ids = change.ids ?? [];
  const base = {
    type: change.type,
    ids,
    ...(change.responseCount !== undefined && { responseCount: change.responseCount }),
  };

  switch (change.type) {
    case "blocks_removed":
      return {
        ...base,
        removes: plural(ids.length, "question block", "question blocks"),
        detail: blocksDetail(change.responseCount),
      };
    case "elements_removed":
      return {
        ...base,
        removes: plural(ids.length, "question", "questions"),
        detail: ANSWERS_DETAIL,
      };
    case "destination_removed":
      return {
        ...base,
        removes: "the destination this live creative opens",
        detail: "The creative is live, so it stops opening anything.",
      };
    case "destination_changed":
      return {
        ...base,
        removes: "the destination this live creative currently opens",
        detail: "The creative is live, so people see the new destination right away.",
      };
    case "survey_left_unopened":
      return {
        ...base,
        removes: "the only way people can open a live in-app survey",
        detail: "The survey has no trigger of its own and this creative was what opened it.",
      };
    default:
      return {
        ...base,
        removes: change.type.replaceAll("_", " "),
        detail: "The server treats this change as destructive.",
      };
  }
};

const DESTINATION_REASONS: Record<string, string> = {
  destination_removed: "Removes what this live creative opens.",
  destination_changed: "Changes what this live creative opens.",
  survey_left_unopened: "Leaves a live in-app survey with nothing to open it.",
};

const isDestinationPath = (path: string): boolean =>
  path === "destination" || path.startsWith("destination.") || path.startsWith("destination[");

/** Marks the entries a destructive change is about, so the view can call them out where they appear. */
export const markDestructiveChanges = (
  changes: TDocumentChange[],
  destructive: TDestructiveSummary[]
): TDocumentChange[] => {
  if (destructive.length === 0) return changes;

  const removedIds = new Map<string, string>();
  const destinationReasons: string[] = [];
  for (const summary of destructive) {
    if (summary.type === "blocks_removed" || summary.type === "elements_removed") {
      const reason =
        summary.type === "blocks_removed"
          ? "Removes a question block that may have responses."
          : "Removes a question that may have responses.";
      for (const id of summary.ids) removedIds.set(id, reason);
    } else if (summary.type in DESTINATION_REASONS) {
      destinationReasons.push(DESTINATION_REASONS[summary.type]);
    }
  }

  return changes.map((change) => {
    if (change.kind === "removed") {
      const id = /\[([^\]]+)\]$/.exec(change.path)?.[1];
      const reason = id ? removedIds.get(id) : undefined;
      if (reason) return { ...change, destructive: true, reason };
    }
    if (destinationReasons.length > 0 && isDestinationPath(change.path)) {
      return { ...change, destructive: true, reason: destinationReasons.join(" ") };
    }
    return change;
  });
};

export type TLimitedChanges = {
  changes: TDocumentChange[];
  /** How many changes were left out of `changes` because of the cap. */
  omitted: number;
};

/**
 * The entries the result carries: values cut to size and the list capped. Destructive entries are kept
 * first, because a review that hid the one removal that matters would be worse than one that hid a
 * hundred small edits; the rest keep their document order.
 */
export const limitChanges = (
  changes: TDocumentChange[],
  maxListed: number = MAX_LISTED_CHANGES
): TLimitedChanges => {
  const indexed = changes.map((change, index) => ({ change, index }));
  const destructive = indexed.filter(({ change }) => change.destructive);
  const others = indexed.filter(({ change }) => !change.destructive);
  const kept = [
    ...destructive.slice(0, maxListed),
    ...others.slice(0, Math.max(0, maxListed - destructive.length)),
  ]
    .sort((left, right) => left.index - right.index)
    .map(({ change }) => ({
      ...change,
      ...(change.before !== undefined && { before: limitValue(change.before) }),
      ...(change.after !== undefined && { after: limitValue(change.after) }),
    }));

  return { changes: kept, omitted: changes.length - kept.length };
};
