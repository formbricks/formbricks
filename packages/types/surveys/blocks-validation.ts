import type { TActionJumpToBlock, TSurveyBlock, TSurveyBlockLogicAction } from "./blocks";

export const findBlocksWithCyclicLogic = (blocks: TSurveyBlock[]): string[] => {
  const visited: Record<string, boolean> = {};
  const recStack: Record<string, boolean> = {};
  const cyclicBlocks = new Set<string>();

  const isBlock = (id: string): boolean => blocks.some((b) => b.id === id);

  /** Marks `blockId` cyclic and leaves it, for a block whose jump, fallback or next block cycles. */
  const markCyclic = (blockId: string): true => {
    cyclicBlocks.add(blockId);
    recStack[blockId] = false;
    return true;
  };

  /** Whether following `destination` reaches a cycle: unvisited and cyclic, or still on the stack. */
  const leadsToCycle = (destination: string): boolean =>
    (!visited[destination] && checkForCyclicLogic(destination)) || Boolean(recStack[destination]);

  /** The blocks a block can go to next: its jump targets, its fallback, then the following block. */
  const destinationsOf = (blockId: string): string[] => {
    const block = blocks.find((b) => b.id === blockId);
    // Jump targets and a fallback that are not blocks are ending cards, and are skipped.
    const jumpTargets = (block?.logic ?? [])
      .flatMap((logic) => findJumpToBlockActions(logic.actions))
      .map((jumpAction) => jumpAction.target)
      .filter(isBlock);
    const fallback = block?.logicFallback && isBlock(block.logicFallback) ? [block.logicFallback] : [];
    // Default behavior: move to the next block if no jump actions or fallback logic is defined
    const nextBlock = blocks[blocks.findIndex((b) => b.id === blockId) + 1] as TSurveyBlock | undefined;
    return [...jumpTargets, ...fallback, ...(nextBlock ? [nextBlock.id] : [])];
  };

  const checkForCyclicLogic = (blockId: string): boolean => {
    if (!visited[blockId]) {
      visited[blockId] = true;
      recStack[blockId] = true;

      if (destinationsOf(blockId).some(leadsToCycle)) return markCyclic(blockId);
    }

    recStack[blockId] = false;
    return false;
  };

  for (const block of blocks) {
    checkForCyclicLogic(block.id);
  }

  return Array.from(cyclicBlocks);
};

// Helper function to find all "jumpToBlock" actions in the logic
const findJumpToBlockActions = (actions: TSurveyBlockLogicAction[]): TActionJumpToBlock[] => {
  return actions.filter((action): action is TActionJumpToBlock => action.objective === "jumpToBlock");
};
