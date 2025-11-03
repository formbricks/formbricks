import "server-only";
import { Result, err, ok } from "@formbricks/types/error-handlers";
import { InvalidInputError } from "@formbricks/types/errors";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSegment } from "@formbricks/types/segment";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
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
 * Validates that all image URLs in blocks (elements and their choices) are valid
 * @param blocks - Array of survey blocks to validate
 * @returns Result with void data on success or Error on failure
 */
export const checkForInvalidImagesInBlocks = (blocks: TSurveyBlock[]): Result<void, Error> => {
  for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
    const block = blocks[blockIdx];

    for (let elementIdx = 0; elementIdx < block.elements.length; elementIdx++) {
      const element = block.elements[elementIdx];

      // Check element imageUrl
      if (element.imageUrl) {
        if (!isValidImageFile(element.imageUrl)) {
          return err(
            new Error(
              `Invalid image URL in element "${element.id}" (element ${elementIdx + 1}) of block "${block.name}" (block ${blockIdx + 1})`
            )
          );
        }
      }

      // Check choices for picture selection and multiple choice elements
      if ("choices" in element && Array.isArray(element.choices)) {
        for (let choiceIdx = 0; choiceIdx < element.choices.length; choiceIdx++) {
          const choice = element.choices[choiceIdx];
          if ("imageUrl" in choice && choice.imageUrl) {
            if (!isValidImageFile(choice.imageUrl)) {
              return err(
                new Error(
                  `Invalid image URL in choice ${choiceIdx + 1} of element "${element.id}" in block "${block.name}"`
                )
              );
            }
          }
        }
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
