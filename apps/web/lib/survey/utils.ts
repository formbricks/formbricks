import "server-only";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { InvalidInputError } from "@formbricks/types/errors";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSegment } from "@formbricks/types/segment";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import {
  TSurveyElement,
  TSurveyElementTypeEnum,
  TSurveyPictureChoice,
} from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { isValidVideoUrl } from "@/lib/utils/video-upload";
import { isValidImageFile } from "@/modules/storage/utils";

export const transformPrismaSurvey = <T extends TSurvey | TJsEnvironmentStateSurvey>(
  surveyPrisma: any
): T => {
  let segment: TSegment | null = null;

  if (surveyPrisma.segment) {
    segment = {
      ...surveyPrisma.segment,
      surveys: surveyPrisma.segment.surveys.map((survey) => survey.id),
    };
  }

  const transformedSurvey = {
    ...surveyPrisma,
    displayPercentage: Number(surveyPrisma.displayPercentage) || null,
    segment,
  } as T;

  return transformedSurvey;
};

export const anySurveyHasFilters = (surveys: TSurvey[]): boolean => {
  return surveys.some((survey) => {
    if ("segment" in survey && survey.segment) {
      return survey.segment.filters && survey.segment.filters.length > 0;
    }
    return false;
  });
};

export const checkForInvalidImagesInQuestions = (questions: TSurveyQuestion[]) => {
  questions.forEach((question, qIndex) => {
    if (question.imageUrl && !isValidImageFile(question.imageUrl)) {
      throw new InvalidInputError(`Invalid image file in question ${String(qIndex + 1)}`);
    }

    if (question.type === TSurveyQuestionTypeEnum.PictureSelection) {
      if (!Array.isArray(question.choices)) {
        throw new InvalidInputError(`Choices missing for question ${String(qIndex + 1)}`);
      }

      question.choices.forEach((choice, cIndex) => {
        if (!isValidImageFile(choice.imageUrl)) {
          throw new InvalidInputError(
            `Invalid image file for choice ${String(cIndex + 1)} in question ${String(qIndex + 1)}`
          );
        }
      });
    }
  });
};

/**
 * Validates a single choice's image URL
 * @param choice - Choice to validate
 * @param choiceIdx - Index of the choice for error reporting
 * @param elementIdx - Index of the element for error reporting
 * @param blockName - Block name for error reporting
 * @returns Result with void data on success or Error on failure
 */
const validateChoiceImage = (
  choice: TSurveyPictureChoice,
  choiceIdx: number,
  elementIdx: number,
  blockName: string
): Result<void, Error> => {
  if (choice.imageUrl && !isValidImageFile(choice.imageUrl)) {
    return err(
      new Error(
        `Invalid image URL in choice ${choiceIdx + 1} of question ${elementIdx + 1} of block "${blockName}"`
      )
    );
  }
  return ok(undefined);
};

/**
 * Validates choice images for picture selection elements
 * Only picture selection elements have imageUrl in choices
 * @param element - Element with choices to validate
 * @param elementIdx - Index of the element for error reporting
 * @param blockName - Block name for error reporting
 * @returns Result with void data on success or Error on failure
 */
const validatePictureSelectionChoiceImages = (
  element: TSurveyElement,
  elementIdx: number,
  blockName: string
): Result<void, Error> => {
  // Only validate choices for picture selection elements
  if (element.type !== TSurveyElementTypeEnum.PictureSelection) {
    return ok(undefined);
  }

  if (!("choices" in element) || !Array.isArray(element.choices)) {
    return ok(undefined);
  }

  for (let choiceIdx = 0; choiceIdx < element.choices.length; choiceIdx++) {
    const result = validateChoiceImage(element.choices[choiceIdx], choiceIdx, elementIdx, blockName);
    if (!result.ok) {
      return result;
    }
  }

  return ok(undefined);
};

/**
 * Validates a single element's image URL, video URL, and picture selection choice images
 * @param element - Element to validate
 * @param elementIdx - Index of the element for error reporting
 * @param blockIdx - Index of the block for error reporting
 * @param blockName - Block name for error reporting
 * @returns Result with void data on success or Error on failure
 */
const validateElement = (
  element: TSurveyElement,
  elementIdx: number,
  blockIdx: number,
  blockName: string
): Result<void, Error> => {
  // Check element imageUrl
  if (element.imageUrl && !isValidImageFile(element.imageUrl)) {
    return err(
      new Error(
        `Invalid image URL in question ${elementIdx + 1} of block "${blockName}" (block ${blockIdx + 1})`
      )
    );
  }

  // Check element videoUrl
  if (element.videoUrl && !isValidVideoUrl(element.videoUrl)) {
    return err(
      new Error(
        `Invalid video URL in question ${elementIdx + 1} of block "${blockName}" (block ${blockIdx + 1}). Only YouTube, Vimeo, and Loom URLs are supported.`
      )
    );
  }

  // Check choices for picture selection
  return validatePictureSelectionChoiceImages(element, elementIdx, blockName);
};

/**
 * Validates that all media URLs (images and videos) in blocks are valid
 * - Validates element imageUrl
 * - Validates element videoUrl
 * - Validates choice imageUrl for picture selection elements
 * @param blocks - Array of survey blocks to validate
 * @returns Result with void data on success or Error on failure
 */
export const checkForInvalidMediaInBlocks = (blocks: TSurveyBlock[]): Result<void, Error> => {
  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx];

    for (let elementIdx = 0; elementIdx < block.elements.length; elementIdx++) {
      const result = validateElement(block.elements[elementIdx], elementIdx, blockIdx, block.name);
      if (!result.ok) {
        return result;
      }
    }
  }

  return ok(undefined);
};

/**
 * Strips isDraft field from elements before saving to database
 * Note: Blocks don't have isDraft since block IDs are CUIDs (not user-editable)
 * Only element IDs need protection as they're user-editable and used in responses
 * @param blocks - Array of survey blocks
 * @returns New array with isDraft stripped from all elements
 */
export const stripIsDraftFromBlocks = (blocks: TSurveyBlock[]): TSurveyBlock[] => {
  return blocks.map((block) => ({
    ...block,
    elements: block.elements.map((element) => {
      const { isDraft, ...elementRest } = element;
      return elementRest;
    }),
  }));
};

/**
 * Validates and prepares blocks for persistence
 * - Validates all media URLs (images and videos) in blocks
 * - Strips isDraft flags from elements
 * @param blocks - Array of survey blocks to validate and prepare
 * @returns Prepared blocks ready for database persistence
 * @throws Error if any media validation fails
 */
export const validateMediaAndPrepareBlocks = (blocks: TSurveyBlock[]): TSurveyBlock[] => {
  // Validate media (images and videos)
  const validation = checkForInvalidMediaInBlocks(blocks);
  if (!validation.ok) {
    throw validation.error;
  }

  // Strip isDraft
  return stripIsDraftFromBlocks(blocks);
};

/**
 * Derives a flat array of elements from the survey's blocks structure
 * Useful for server-side processing where we need to iterate over all questions
 * Note: This is duplicated from the client-side survey utils since this file is server-only
 * @param blocks - Array of survey blocks
 * @returns Flat array of all elements across all blocks
 */
export const getElementsFromBlocks = (blocks: TSurveyBlock[]): TSurveyElement[] => {
  return blocks.flatMap((block) => block.elements);
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
