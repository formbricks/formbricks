/**
 * Where the stacked cards stand after Back lands on `blockIdx`: the visited stack loses its top, and the
 * card behind the current one is the block visited before it. With nothing left on the stack it is the
 * slot before `blockIdx`, exactly as on the first render (`blockIdx - 1`, which is negative before the
 * first block). Clamping it to 0 made it equal the current (or the next) card on the way back to the
 * start, so two cards rendered with the same key.
 */
export const getStackAfterBack = (
  visitedBlocks: readonly number[],
  blockIdx: number
): { visitedBlocks: number[]; prevBlockIdx: number } => {
  const stack = visitedBlocks.slice(0, -1);
  return { visitedBlocks: stack, prevBlockIdx: stack.at(-1) ?? blockIdx - 1 };
};
