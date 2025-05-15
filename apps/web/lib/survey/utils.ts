import "server-only";
import { isValidImageFile } from "@/lib/fileValidation";
import { InvalidInputError } from "@formbricks/types/errors";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";

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
