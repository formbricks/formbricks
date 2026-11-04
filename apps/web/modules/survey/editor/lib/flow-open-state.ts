/**
 * Which blocks of the Flow tab are open. The editor keeps the set of *expanded* block ids, so the
 * tab opens with every block collapsed and a block added later starts collapsed too. The set lives in
 * the survey editor, not in the Flow tab, which unmounts on every tab switch. Sets are never changed
 * in place: each function returns a new one.
 */

/** What the one Expand / Collapse button does: expand while any block is collapsed. */
export const getBlockToggle = (
  blocks: readonly { id: string }[],
  expandedBlockIds: ReadonlySet<string>
): "expand" | "collapse" =>
  // Checked against the blocks there are: the set may still hold the id of a deleted block.
  blocks.length > 0 && blocks.every((block) => expandedBlockIds.has(block.id)) ? "collapse" : "expand";

export const toggleBlock = (expandedBlockIds: ReadonlySet<string>, blockId: string): Set<string> => {
  const next = new Set(expandedBlockIds);
  if (next.has(blockId)) next.delete(blockId);
  else next.add(blockId);
  return next;
};

/**
 * The flagged rule a save or publish opens on the Flow tab, with its block: the one its toast names.
 * The menu bar lists a pass's flags first, in the schema's issue order, so that is the first rule in
 * `invalidIds`. Nothing opens for the pass already handled (`previousIds` is that same list, as when
 * the tab mounts again), nor when flags only went away: a rule fixed and cleared must not move the
 * open row elsewhere.
 */
export const getRuleToReveal = (
  invalidIds: readonly string[] | null,
  previousIds: readonly string[] | null,
  ruleIds: readonly string[]
): string | undefined => {
  if (!invalidIds?.length || invalidIds === previousIds) return undefined;
  const onlyCleared =
    previousIds !== null &&
    invalidIds.length < previousIds.length &&
    invalidIds.every((id) => previousIds.includes(id));
  if (onlyCleared) return undefined;
  return invalidIds.find((id) => ruleIds.includes(id));
};

/** The set with the block open; the same set when it already is, so React skips the update. */
export const expandBlock = (expandedBlockIds: Set<string>, blockId: string): Set<string> =>
  expandedBlockIds.has(blockId) ? expandedBlockIds : new Set([...expandedBlockIds, blockId]);
