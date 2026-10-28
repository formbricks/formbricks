/**
 * The Export modal's "Include columns" list (ENG-6792): which groups of columns the file keeps. Pure, with no
 * server imports, so the modal and the route read the same rules.
 *
 * The list holds one entry per question, per Embedded Data field and per fixed column, not one per cell: a
 * multi-select with ten options is one line. The modal keeps what the person switched OFF, so the Standard
 * defaults (everything on) send nothing and produce today's file.
 */

export type TExportColumnGroup = {
  /** Stable across exports of the same survey: `q:<questionId>`, `e:<field>`, `r:<column>` or a fixed name. */
  id: string;
  /** What the list shows, e.g. `q1 · How do you like these things?`. */
  label: string;
};

export type TSelectAllState = boolean | "indeterminate";

const isOff = (excluded: readonly string[], id: string): boolean => excluded.includes(id);

/** The groups the file keeps. */
export const selectedGroups = (
  groups: readonly TExportColumnGroup[],
  excluded: readonly string[]
): TExportColumnGroup[] => groups.filter((group) => !isOff(excluded, group.id));

/** Whether the person emptied the list. An empty list (still loading) is not a selection to complain about. */
export const hasNoColumnSelected = (
  groups: readonly TExportColumnGroup[],
  excluded: readonly string[]
): boolean => groups.length > 0 && selectedGroups(groups, excluded).length === 0;

/** Select all: ticked when every group is on, a dash when some are, empty when none are. */
export const selectAllState = (
  groups: readonly TExportColumnGroup[],
  excluded: readonly string[]
): TSelectAllState => {
  const selected = selectedGroups(groups, excluded).length;
  if (selected === 0) return false;
  return selected === groups.length ? true : "indeterminate";
};

/** Ticking Select all turns everything on; unticking it, when everything is on, turns everything off. */
export const toggleSelectAll = (
  groups: readonly TExportColumnGroup[],
  excluded: readonly string[]
): string[] => (selectAllState(groups, excluded) === true ? groups.map((group) => group.id) : []);

export const toggleGroup = (excluded: readonly string[], id: string, on: boolean): string[] => {
  const others = excluded.filter((current) => current !== id);
  return on ? others : [...others, id];
};

/** What the request carries: only groups the current list has, so ids left from another list do not travel. */
export const excludedForRequest = (
  groups: readonly TExportColumnGroup[],
  excluded: readonly string[]
): string[] => groups.filter((group) => isOff(excluded, group.id)).map((group) => group.id);
