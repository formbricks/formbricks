/**
 * The stacked cards on screen: the card behind the current one, the current card, the one peeking
 * after it, and the blocks visited on the way here (what Back returns through). Before the first
 * block the previous slot is negative, which renders a placeholder.
 */
export interface TCardStack {
  prevBlockIdx: number;
  currentBlockIdx: number;
  nextBlockIdx: number;
  visitedBlocks: number[];
}

export const initialCardStack = (blockIdx: number): TCardStack => ({
  prevBlockIdx: blockIdx - 1,
  currentBlockIdx: blockIdx,
  nextBlockIdx: blockIdx + 1,
  visitedBlocks: [],
});

/**
 * The stack once the survey moves to `blockIdx`. Forward, the current card goes behind and onto the
 * visited stack. Back, the visited stack loses its top and the card behind is the block visited before
 * it, or the slot before `blockIdx` when nothing is left, exactly as on the first render. (Clamping
 * that slot to 0 made it equal the current card, or the next one from the welcome card, so two cards
 * rendered with the same key.) The same index leaves the stack as it is.
 */
export const moveCardStack = (stack: TCardStack, blockIdx: number): TCardStack => {
  if (blockIdx > stack.currentBlockIdx) {
    return {
      prevBlockIdx: stack.currentBlockIdx,
      currentBlockIdx: blockIdx,
      nextBlockIdx: blockIdx + 1,
      visitedBlocks: [...stack.visitedBlocks, stack.currentBlockIdx],
    };
  }
  if (blockIdx < stack.currentBlockIdx) {
    const visitedBlocks = stack.visitedBlocks.slice(0, -1);
    return {
      prevBlockIdx: visitedBlocks.at(-1) ?? blockIdx - 1,
      currentBlockIdx: blockIdx,
      nextBlockIdx: stack.currentBlockIdx,
      visitedBlocks,
    };
  }
  return stack;
};
