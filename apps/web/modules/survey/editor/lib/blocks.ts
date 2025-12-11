import { createId } from "@paralleldrive/cuid2";
import { TFunction } from "i18next";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElement } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import { createI18nString } from "@/lib/i18n/utils";

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Checks if an element ID is unique across all blocks
 * @param elementId - The element ID to check
 * @param blocks - Array of all blocks in the survey
 * @returns true if the element ID is unique, false otherwise
 */
export const isElementIdUnique = (elementId: string, blocks: TSurveyBlock[]): boolean => {
  for (const block of blocks) {
    if (block.elements.some((e) => e.id === elementId)) {
      return false;
    }
  }
  return true;
};

/**
 * Find the location of an element within the survey blocks
 * @param survey - The survey object
 * @param elementId - The ID of the element to find
 * @returns Object containing blockId, blockIndex, elementIndex and the block
 */
export const findElementLocation = (
  survey: TSurvey,
  elementId: string
): { blockId: string | null; blockIndex: number; elementIndex: number; block: TSurveyBlock | null } => {
  const blocks = survey.blocks;

  for (let blockIndex = 0; blockIndex < blocks.length; blockIndex++) {
    const block = blocks[blockIndex];
    const elementIndex = block.elements.findIndex((e) => e.id === elementId);
    if (elementIndex !== -1) {
      return { blockId: block.id, blockIndex, elementIndex, block };
    }
  }

  return { blockId: null, blockIndex: -1, elementIndex: -1, block: null };
};

// ============================================
// BLOCK OPERATIONS
// ============================================

/**
 * Renumbers all blocks sequentially (Block 1, Block 2, Block 3, etc.)
 * This ensures block names stay in sync with their positions
 * @param blocks - Array of blocks to renumber
 * @returns Array of blocks with updated sequential names
 */
export const renumberBlocks = (blocks: TSurveyBlock[]): TSurveyBlock[] => {
  return blocks.map((block, index) => ({
    ...block,
    name: `Block ${index + 1}`,
  }));
};

/**
 * Adds a new block to the survey. Always generates a new CUID for the block ID to prevent conflicts
 * @param survey - The survey to add the block to
 * @param block - Block data (without id, which is auto-generated)
 * @param index - Optional index to insert the block at (appends if not provided)
 * @returns Result with updated survey or Error
 */
export const addBlock = (
  t: TFunction,
  survey: TSurvey,
  block: Omit<Partial<TSurveyBlock>, "id">,
  index?: number
): Result<TSurvey, Error> => {
  const updatedSurvey = { ...survey };
  const blocks = [...(survey.blocks || [])];

  const newBlock: TSurveyBlock = {
    ...block,
    id: createId(),
    name: block.name || t("environments.surveys.edit.untitled_block"),
    elements: block.elements || [],
    buttonLabel: createI18nString(block.buttonLabel || t("templates.next"), []),
    backButtonLabel: createI18nString(block.backButtonLabel || t("templates.back"), []),
  };

  if (index === undefined) {
    blocks.push(newBlock);
  } else {
    if (index < 0 || index > blocks.length) {
      return err(new Error(`Invalid index ${index}. Must be between 0 and ${blocks.length}`));
    }

    blocks.splice(index, 0, newBlock);
  }

  // Renumber blocks sequentially after adding
  const renumberedBlocks = renumberBlocks(blocks);

  updatedSurvey.blocks = renumberedBlocks;
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
  updatedAttributes: Omit<Partial<TSurveyBlock>, "id">
): Result<TSurvey, Error> => {
  // id is not allowed from the types but this will also prevent the error during runtime
  if ("id" in updatedAttributes) {
    return err(new Error("Block ID cannot be updated"));
  }

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
  // Prevent deleting the last block
  if (survey.blocks?.length === 1) {
    return err(new Error("Cannot delete the last block in the survey"));
  }

  const filteredBlocks = survey.blocks?.filter((b) => b.id !== blockId) || [];

  if (filteredBlocks.length === survey.blocks?.length) {
    return err(new Error(`Block with ID "${blockId}" not found`));
  }

  // Renumber blocks sequentially after deletion
  const renumberedBlocks = renumberBlocks(filteredBlocks);

  return ok({
    ...survey,
    blocks: renumberedBlocks,
  });
};

/**
 * Duplicates a block with new IDs for the block and all elements
 * Note: Logic is cleared because it would reference old block/element IDs.
 * mapping old element IDs to new ones and updating jumpToBlock targets.
 * @param survey - The survey containing the block
 * @param blockId - The CUID of the block to duplicate
 * @returns Result with updated survey or Error
 */
export const duplicateBlock = (survey: TSurvey, blockId: string): Result<TSurvey, Error> => {
  const blocks = survey.blocks || [];
  const blockIndex = blocks.findIndex((b) => b.id === blockId);

  if (blockIndex === -1) {
    return err(new Error(`Block with ID "${blockId}" not found`));
  }

  const blockToDuplicate = blocks[blockIndex];

  // Deep clone the block to avoid any reference issues
  const duplicatedBlock: TSurveyBlock = structuredClone(blockToDuplicate);

  // Assign new IDs
  duplicatedBlock.id = createId();
  // Name will be set by renumberBlocks to maintain sequential naming

  // Generate new element IDs to avoid conflicts
  duplicatedBlock.elements = duplicatedBlock.elements.map((element) => ({
    ...element,
    id: createId(),
    isDraft: true,
  }));

  // Clear logic since it references old block/element IDs
  // In the future, we could map these references to the new IDs
  duplicatedBlock.logic = undefined;
  duplicatedBlock.logicFallback = undefined;

  const updatedBlocks = [...blocks];
  updatedBlocks.splice(blockIndex + 1, 0, duplicatedBlock);

  // Renumber blocks sequentially after duplication
  const renumberedBlocks = renumberBlocks(updatedBlocks);

  return ok({
    ...survey,
    blocks: renumberedBlocks,
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

  // Renumber blocks sequentially after reordering
  const renumberedBlocks = renumberBlocks(blocks);

  return ok({
    ...survey,
    blocks: renumberedBlocks,
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

  // Validate element ID is unique across all blocks (including the target block)
  if (!isElementIdUnique(element.id, blocks)) {
    return err(new Error(`Element ID "${element.id}" already exists`));
  }

  const block = { ...blocks[blockIndex] };
  const elements = [...block.elements];

  const elementWithDraft = { ...element, isDraft: true };

  if (index === undefined) {
    elements.push(elementWithDraft);
  } else {
    if (index < 0 || index > elements.length) {
      return err(new Error(`Invalid index ${index}. Must be between 0 and ${elements.length}`));
    }
    elements.splice(index, 0, elementWithDraft);
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

  // If changing the element ID, validate the new ID is unique across all blocks
  if (updatedAttributes.id && updatedAttributes.id !== elementId) {
    if (!isElementIdUnique(updatedAttributes.id, blocks)) {
      return err(new Error(`Element ID "${updatedAttributes.id}" already exists`));
    }
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
 * Generates a new element ID with CUID
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

  // Deep clone the element to avoid any reference issues
  const duplicatedElement: TSurveyElement = structuredClone(elementToDuplicate);
  duplicatedElement.id = createId();
  duplicatedElement.isDraft = true;

  elements.splice(elementIndex + 1, 0, duplicatedElement);
  block.elements = elements;
  blocks[blockIndex] = block;

  return ok({
    ...survey,
    blocks,
  });
};

/**
 * Moves an element up or down within a block
 * @param survey - The survey containing the block
 * @param blockId - The CUID of the block containing the element
 * @param elementId - The ID of the element to move
 * @param direction - Direction to move ("up" or "down")
 * @returns Result with updated survey (or unchanged if at boundary) or Error
 */
export const moveElementInBlock = (
  survey: TSurvey,
  blockId: string,
  elementId: string,
  direction: "up" | "down"
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

  if (direction === "up" && elementIndex === 0) {
    return ok(survey); // Already at top
  }

  if (direction === "down" && elementIndex === elements.length - 1) {
    return ok(survey); // Already at bottom
  }

  const targetIndex = direction === "up" ? elementIndex - 1 : elementIndex + 1;

  // Swap using destructuring assignment
  [elements[elementIndex], elements[targetIndex]] = [elements[targetIndex], elements[elementIndex]];

  block.elements = elements;
  blocks[blockIndex] = block;

  return ok({
    ...survey,
    blocks,
  });
};
