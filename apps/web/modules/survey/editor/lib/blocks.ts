import { createId } from "@paralleldrive/cuid2";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Checks if an element ID is unique across all blocks
 * @param elementId - The element ID to check
 * @param blocks - Array of all blocks in the survey
 * @param currentBlockId - Optional block ID to skip (for updates within same block)
 * @returns true if the element ID is unique, false otherwise
 */
export const isElementIdUnique = (
  elementId: string,
  blocks: TSurveyBlock[],
  currentBlockId?: string
): boolean => {
  for (const block of blocks) {
    // Skip current block if provided (for updates within same block)
    if (currentBlockId && block.id === currentBlockId) continue;

    if (block.elements.some((e) => e.id === elementId)) {
      return false;
    }
  }
  return true;
};

// ============================================
// BLOCK OPERATIONS
// ============================================

/**
 * Adds a new block to the survey. Always generates a new CUID for the block ID to prevent conflicts
 * @param survey - The survey to add the block to
 * @param block - Block data (without id, which is auto-generated)
 * @param index - Optional index to insert the block at (appends if not provided)
 * @returns Result with updated survey or Error
 */
export const addBlock = (
  survey: TSurvey,
  block: Omit<Partial<TSurveyBlock>, "id">,
  index?: number
): Result<TSurvey, Error> => {
  const updatedSurvey = { ...survey };
  const blocks = [...(survey.blocks || [])];

  const newBlock: TSurveyBlock = {
    id: createId(),
    name: block.name || "Untitled Block",
    elements: block.elements || [],
    ...block,
  };

  if (index !== undefined) {
    if (index < 0 || index > blocks.length) {
      return err(new Error(`Invalid index ${index}. Must be between 0 and ${blocks.length}`));
    }
    blocks.splice(index, 0, newBlock);
  } else {
    blocks.push(newBlock);
  }

  updatedSurvey.blocks = blocks;
  return ok(updatedSurvey);
};

/**
 * Updates an existing block with new attributes
 * @param survey - The survey containing the block
 * @param blockId - The CUID of the block to update
 * @param updatedAttributes - Partial block object with fields to update
 * @returns Result with updated survey or Error
 */
export const updateBlock = (
  survey: TSurvey,
  blockId: string,
  updatedAttributes: Partial<TSurveyBlock>
): Result<TSurvey, Error> => {
  const blocks = [...(survey.blocks || [])];
  const blockIndex = blocks.findIndex((b) => b.id === blockId);

  if (blockIndex === -1) {
    return err(new Error(`Block with ID "${blockId}" not found`));
  }

  blocks[blockIndex] = {
    ...blocks[blockIndex],
    ...updatedAttributes,
  };

  return ok({
    ...survey,
    blocks,
  });
};

/**
 * Deletes a block from the survey
 * @param survey - The survey containing the block
 * @param blockId - The CUID of the block to delete
 * @returns Result with updated survey or Error
 */
export const deleteBlock = (survey: TSurvey, blockId: string): Result<TSurvey, Error> => {
  const blocks = [...(survey.blocks || [])];
  const filteredBlocks = blocks.filter((b) => b.id !== blockId);

  if (filteredBlocks.length === blocks.length) {
    return err(new Error(`Block with ID "${blockId}" not found`));
  }

  return ok({
    ...survey,
    blocks: filteredBlocks,
  });
};

/**
 * Duplicates a block with new IDs for the block and all elements
 * Note: Logic is cleared because it would reference old block/element IDs.
 * TODO: In the future, we could update logic references like questions do,
 * mapping old element IDs to new ones and updating jumpToBlock targets.
 * @param survey - The survey containing the block
 * @param blockId - The CUID of the block to duplicate
 * @param options - Optional configuration
 * @param options.newName - Custom name for the duplicated block
 * @param options.insertAfter - Whether to insert after the original (default: true)
 * @returns Result with updated survey or Error
 */
export const duplicateBlock = (
  survey: TSurvey,
  blockId: string,
  options?: { newName?: string; insertAfter?: boolean }
): Result<TSurvey, Error> => {
  const blocks = survey.blocks || [];
  const blockIndex = blocks.findIndex((b) => b.id === blockId);

  if (blockIndex === -1) {
    return err(new Error(`Block with ID "${blockId}" not found`));
  }

  const blockToDuplicate = blocks[blockIndex];
  const newBlockId = createId();

  // Generate new element IDs to avoid conflicts
  const elementsWithNewIds = blockToDuplicate.elements.map((element) => ({
    ...element,
    id: createId(),
  }));

  const duplicatedBlock: TSurveyBlock = {
    ...blockToDuplicate,
    id: newBlockId,
    name: options?.newName || `${blockToDuplicate.name} (copy)`,
    elements: elementsWithNewIds,
    // Clear logic since it references old block/element IDs
    // In the future, we could map these references to the new IDs
    logic: undefined,
    logicFallback: undefined,
  };

  const updatedBlocks = [...blocks];
  const insertIndex = options?.insertAfter !== false ? blockIndex + 1 : blockIndex;
  updatedBlocks.splice(insertIndex, 0, duplicatedBlock);

  return ok({
    ...survey,
    blocks: updatedBlocks,
  });
};

/**
 * Moves a block up or down in the survey
 * @param survey - The survey containing the block
 * @param blockId - The CUID of the block to move
 * @param direction - Direction to move ("up" or "down")
 * @returns Result with updated survey (or unchanged if at boundary) or Error
 */
export const moveBlock = (
  survey: TSurvey,
  blockId: string,
  direction: "up" | "down"
): Result<TSurvey, Error> => {
  const blocks = [...(survey.blocks || [])];
  const blockIndex = blocks.findIndex((b) => b.id === blockId);

  if (blockIndex === -1) {
    return err(new Error(`Block with ID "${blockId}" not found`));
  }

  if (direction === "up" && blockIndex === 0) {
    return ok(survey); // Already at top
  }

  if (direction === "down" && blockIndex === blocks.length - 1) {
    return ok(survey); // Already at bottom
  }

  const targetIndex = direction === "up" ? blockIndex - 1 : blockIndex + 1;

  // Swap using destructuring assignment
  [blocks[blockIndex], blocks[targetIndex]] = [blocks[targetIndex], blocks[blockIndex]];

  return ok({
    ...survey,
    blocks,
  });
};

// ============================================
// ELEMENT OPERATIONS
// ============================================

/**
 * Adds an element to a block
 * Validates that the element ID is unique across all blocks
 * Sets isDraft: true on the element for ID editability
 * @param survey - The survey containing the block
 * @param blockId - The CUID of the block to add the element to
 * @param element - The element to add
 * @param index - Optional index to insert the element at (appends if not provided)
 * @returns Result with updated survey or Error
 */
export const addElementToBlock = (
  survey: TSurvey,
  blockId: string,
  element: TSurveyElement,
  index?: number
): Result<TSurvey, Error> => {
  const blocks = [...(survey.blocks || [])];
  const blockIndex = blocks.findIndex((b) => b.id === blockId);

  if (blockIndex === -1) {
    return err(new Error(`Block with ID "${blockId}" not found`));
  }

  // Validate element ID is unique across all blocks
  if (!isElementIdUnique(element.id, blocks, blockId)) {
    return err(new Error(`Element ID "${element.id}" already exists in another block`));
  }

  const block = { ...blocks[blockIndex] };
  const elements = [...block.elements];

  const elementWithDraft = { ...element, isDraft: true };

  if (index !== undefined) {
    if (index < 0 || index > elements.length) {
      return err(new Error(`Invalid index ${index}. Must be between 0 and ${elements.length}`));
    }
    elements.splice(index, 0, elementWithDraft);
  } else {
    elements.push(elementWithDraft);
  }

  block.elements = elements;
  blocks[blockIndex] = block;

  return ok({
    ...survey,
    blocks,
  });
};

/**
 * Updates an existing element in a block
 * @param survey - The survey containing the block
 * @param blockId - The CUID of the block containing the element
 * @param elementId - The ID of the element to update
 * @param updatedAttributes - Partial element object with fields to update
 * @returns Result with updated survey or Error
 */
export const updateElementInBlock = (
  survey: TSurvey,
  blockId: string,
  elementId: string,
  updatedAttributes: Partial<TSurveyElement>
): Result<TSurvey, Error> => {
  const blocks = [...(survey.blocks || [])];
  const blockIndex = blocks.findIndex((b) => b.id === blockId);

  if (blockIndex === -1) {
    return err(new Error(`Block with ID "${blockId}" not found`));
  }

  const block = { ...blocks[blockIndex] };
  const elements = [...block.elements];
  const elementIndex = elements.findIndex((e) => e.id === elementId);

  if (elementIndex === -1) {
    return err(new Error(`Element with ID "${elementId}" not found in block "${blockId}"`));
  }

  elements[elementIndex] = {
    ...elements[elementIndex],
    ...updatedAttributes,
  } as TSurveyElement;

  block.elements = elements;
  blocks[blockIndex] = block;

  return ok({
    ...survey,
    blocks,
  });
};

/**
 * Deletes an element from a block
 * @param survey - The survey containing the block
 * @param blockId - The CUID of the block containing the element
 * @param elementId - The ID of the element to delete
 * @returns Result with updated survey or Error
 */
export const deleteElementFromBlock = (
  survey: TSurvey,
  blockId: string,
  elementId: string
): Result<TSurvey, Error> => {
  const blocks = [...(survey.blocks || [])];
  const blockIndex = blocks.findIndex((b) => b.id === blockId);

  if (blockIndex === -1) {
    return err(new Error(`Block with ID "${blockId}" not found`));
  }

  const block = { ...blocks[blockIndex] };
  const originalLength = block.elements.length;
  block.elements = block.elements.filter((e) => e.id !== elementId);

  if (block.elements.length === originalLength) {
    return err(new Error(`Element with ID "${elementId}" not found in block "${blockId}"`));
  }

  blocks[blockIndex] = block;

  return ok({
    ...survey,
    blocks,
  });
};

/**
 * Duplicates an element within a block
 * Generates a new element ID with "_copy_" suffix
 * Sets isDraft: true on the duplicated element
 * @param survey - The survey containing the block
 * @param blockId - The CUID of the block containing the element
 * @param elementId - The ID of the element to duplicate
 * @returns Result with updated survey or Error
 */
export const duplicateElementInBlock = (
  survey: TSurvey,
  blockId: string,
  elementId: string
): Result<TSurvey, Error> => {
  const blocks = [...(survey.blocks || [])];
  const blockIndex = blocks.findIndex((b) => b.id === blockId);

  if (blockIndex === -1) {
    return err(new Error(`Block with ID "${blockId}" not found`));
  }

  const block = { ...blocks[blockIndex] };
  const elements = [...block.elements];
  const elementIndex = elements.findIndex((e) => e.id === elementId);

  if (elementIndex === -1) {
    return err(new Error(`Element with ID "${elementId}" not found in block "${blockId}"`));
  }

  const elementToDuplicate = elements[elementIndex];

  const duplicatedElement: TSurveyElement = {
    ...elementToDuplicate,
    id: createId(),
    isDraft: true,
  } as TSurveyElement;

  elements.splice(elementIndex + 1, 0, duplicatedElement);
  block.elements = elements;
  blocks[blockIndex] = block;

  return ok({
    ...survey,
    blocks,
  });
};
