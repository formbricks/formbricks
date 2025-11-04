import type { TActionJumpToBlock, TSurveyBlock, TSurveyBlockLogicAction } from "./blocks";

export const findBlocksWithCyclicLogic = (blocks: TSurveyBlock[]): string[] => {
  const visited: Record<string, boolean> = {};
  const recStack: Record<string, boolean> = {};
  const cyclicBlocks = new Set<string>();

  const checkForCyclicLogic = (blockId: string): boolean => {
    if (!visited[blockId]) {
      visited[blockId] = true;
      recStack[blockId] = true;

      const block = blocks.find((b) => b.id === blockId);
      if (block?.logic && block.logic.length > 0) {
        for (const logic of block.logic) {
          const jumpActions = findJumpToBlockActions(logic.actions);
          for (const jumpAction of jumpActions) {
            const destination = jumpAction.target;

            // Skip if destination is not a valid block ID (it's an ending card)
            if (!blocks.find((b) => b.id === destination)) {
              continue;
            }

            if (!visited[destination] && checkForCyclicLogic(destination)) {
              cyclicBlocks.add(blockId);
              recStack[blockId] = false;
              return true;
            } else if (recStack[destination]) {
              cyclicBlocks.add(blockId);
              recStack[blockId] = false;
              return true;
            }
          }
        }
      }

      // Check fallback logic
      if (block?.logicFallback) {
        const fallbackBlockId = block.logicFallback;

        // Skip if fallback is not a valid block (it's an ending card)
        if (blocks.find((b) => b.id === fallbackBlockId)) {
          if (!visited[fallbackBlockId] && checkForCyclicLogic(fallbackBlockId)) {
            cyclicBlocks.add(blockId);
            recStack[blockId] = false;
            return true;
          } else if (recStack[fallbackBlockId]) {
            cyclicBlocks.add(blockId);
            recStack[blockId] = false;
            return true;
          }
        }
      }

      // Handle default behavior: move to the next block if no jump actions or fallback logic is defined
      const nextBlockIndex = blocks.findIndex((b) => b.id === blockId) + 1;
      const nextBlock = blocks[nextBlockIndex] as TSurveyBlock | undefined;
      if (nextBlock) {
        if (!visited[nextBlock.id] && checkForCyclicLogic(nextBlock.id)) {
          cyclicBlocks.add(blockId);
          recStack[blockId] = false;
          return true;
        } else if (recStack[nextBlock.id]) {
          cyclicBlocks.add(blockId);
          recStack[blockId] = false;
          return true;
        }
      }
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
