/**
 * The Export modal's "Include columns" list (ENG-6792): which groups of columns the file keeps. Pure, with no
 * server imports, so the modal and the route read the same rules.
 *
 * The list holds one entry per question, per Embedded Data field and per fixed column, not one per cell. A
 * multi-select question also lists its options and its Other text under it (`parentId`), so one can be left
 * out without the rest. The modal keeps what the person switched OFF, so the Standard defaults (everything
 * on) send nothing and produce today's file.
 */

export type TExportColumnGroup = {
  /** Stable across exports of the same survey: `q:<questionId>`, `e:<field>`, `r:<column>` or a fixed name. */
  id: string;
  /** What the list shows, e.g. `q1 · How do you like these things?`. */
  label: string;
  /** Set on an option of a multi-select question: the id of the question entry it is listed under. */
  parentId?: string;
};

export type TSelectAllState = boolean | "indeterminate";

const isOff = (excluded: readonly string[], id: string): boolean => excluded.includes(id);

/** Whether the file keeps the entry: it is on, and so is the question it is listed under. */
const isKept = (excluded: readonly string[], group: TExportColumnGroup): boolean =>
  !isOff(excluded, group.id) && !(group.parentId && isOff(excluded, group.parentId));

/** The entries that hold columns: a question with options holds none itself, its options do. */
const columnEntries = (groups: readonly TExportColumnGroup[]): TExportColumnGroup[] => {
  const parents = new Set(groups.flatMap((group) => (group.parentId ? [group.parentId] : [])));
  return groups.filter((group) => !parents.has(group.id));
};

/** The entries the file keeps columns of. */
export const selectedGroups = (
  groups: readonly TExportColumnGroup[],
  excluded: readonly string[]
): TExportColumnGroup[] => columnEntries(groups).filter((group) => isKept(excluded, group));

/** Whether the person emptied the list. An empty list (still loading) is not a selection to complain about. */
export const hasNoColumnSelected = (
  groups: readonly TExportColumnGroup[],
  excluded: readonly string[]
): boolean => groups.length > 0 && selectedGroups(groups, excluded).length === 0;

/** Select all, and a question with options: ticked when everything under it is on, a dash when some is. */
const stateOf = (entries: readonly TExportColumnGroup[], excluded: readonly string[]): TSelectAllState => {
  const kept = entries.filter((group) => isKept(excluded, group)).length;
  if (kept === 0) return false;
  return kept === entries.length ? true : "indeterminate";
};

export const selectAllState = (
  groups: readonly TExportColumnGroup[],
  excluded: readonly string[]
): TSelectAllState => stateOf(columnEntries(groups), excluded);

/** The checkbox of one entry. A question with options reads from them. */
export const groupState = (
  groups: readonly TExportColumnGroup[],
  excluded: readonly string[],
  group: TExportColumnGroup
): TSelectAllState => {
  const options = groups.filter((candidate) => candidate.parentId === group.id);
  return options.length === 0 ? isKept(excluded, group) : stateOf(options, excluded);
};

/** Ticking Select all turns everything on; unticking it, when everything is on, turns everything off. */
export const toggleSelectAll = (
  groups: readonly TExportColumnGroup[],
  excluded: readonly string[]
): string[] => (selectAllState(groups, excluded) === true ? groups.map((group) => group.id) : []);

/**
 * Switches one entry. A question takes its options with it; an option ticked under a question that is off
 * brings the question back with only that option on.
 */
export const toggleGroup = (
  groups: readonly TExportColumnGroup[],
  excluded: readonly string[],
  id: string,
  on: boolean
): string[] => {
  const options = new Set(groups.filter((group) => group.parentId === id).map((group) => group.id));
  const rest = excluded.filter((current) => current !== id && !options.has(current));
  if (!on) return [...rest, id];
  const parentId = groups.find((group) => group.id === id)?.parentId;
  if (!parentId || !isOff(excluded, parentId)) return rest;
  const siblings = groups.filter((group) => group.parentId === parentId && group.id !== id);
  return [...rest.filter((current) => current !== parentId), ...siblings.map((group) => group.id)];
};

/** What the request carries: only groups the current list has, so ids left from another list do not travel. */
export const excludedForRequest = (
  groups: readonly TExportColumnGroup[],
  excluded: readonly string[]
): string[] => groups.filter((group) => isOff(excluded, group.id)).map((group) => group.id);
