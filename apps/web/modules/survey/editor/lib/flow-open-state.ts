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

/** The set with the block open; the same set when it already is, so React skips the update. */
export const expandBlock = (expandedBlockIds: Set<string>, blockId: string): Set<string> =>
  expandedBlockIds.has(blockId) ? expandedBlockIds : new Set([...expandedBlockIds, blockId]);
