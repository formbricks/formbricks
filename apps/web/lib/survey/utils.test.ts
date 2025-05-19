import * as fileValidation from "@/lib/fileValidation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSegment } from "@formbricks/types/segment";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import { anySurveyHasFilters, checkForInvalidImagesInQuestions, transformPrismaSurvey } from "./utils";

describe("transformPrismaSurvey", () => {
  test("transforms prisma survey without segment", () => {
    const surveyPrisma = {
      id: "survey1",
      name: "Test Survey",
      displayPercentage: "30",
      segment: null,
    };

    const result = transformPrismaSurvey(surveyPrisma);

    expect(result).toEqual({
      id: "survey1",
      name: "Test Survey",
      displayPercentage: 30,
      segment: null,
    });
  });

  test("transforms prisma survey with segment", () => {
    const surveyPrisma = {
      id: "survey1",
      name: "Test Survey",
      displayPercentage: "50",
      segment: {
        id: "segment1",
        name: "Test Segment",
        filters: [{ id: "filter1", type: "user" }],
        surveys: [{ id: "survey1" }, { id: "survey2" }],
      },
    };

    const result = transformPrismaSurvey<TSurvey>(surveyPrisma);

    expect(result).toEqual({
      id: "survey1",
      name: "Test Survey",
      displayPercentage: 50,
      segment: {
        id: "segment1",
        name: "Test Segment",
        filters: [{ id: "filter1", type: "user" }],
        surveys: ["survey1", "survey2"],
      },
    });
  });

  test("transforms prisma survey with non-numeric displayPercentage", () => {
    const surveyPrisma = {
      id: "survey1",
      name: "Test Survey",
      displayPercentage: "invalid",
    };

    const result = transformPrismaSurvey<TJsEnvironmentStateSurvey>(surveyPrisma);

    expect(result).toEqual({
      id: "survey1",
      name: "Test Survey",
      displayPercentage: null,
      segment: null,
    });
  });

  test("transforms prisma survey with undefined displayPercentage", () => {
    const surveyPrisma = {
      id: "survey1",
      name: "Test Survey",
    };

    const result = transformPrismaSurvey(surveyPrisma);

    expect(result).toEqual({
      id: "survey1",
      name: "Test Survey",
      displayPercentage: null,
      segment: null,
    });
  });
});

describe("anySurveyHasFilters", () => {
  test("returns false when no surveys have segments", () => {
    const surveys = [
      { id: "survey1", name: "Survey 1" },
      { id: "survey2", name: "Survey 2" },
    ] as TSurvey[];

    expect(anySurveyHasFilters(surveys)).toBe(false);
  });

  test("returns false when surveys have segments but no filters", () => {
    const surveys = [
      {
        id: "survey1",
        name: "Survey 1",
        segment: {
          id: "segment1",
          title: "Segment 1",
          filters: [],
          createdAt: new Date(),
          description: "Segment description",
          environmentId: "env1",
          isPrivate: true,
          surveys: ["survey1"],
          updatedAt: new Date(),
        } as TSegment,
      },
      { id: "survey2", name: "Survey 2" },
    ] as TSurvey[];

    expect(anySurveyHasFilters(surveys)).toBe(false);
  });

  test("returns true when at least one survey has segment with filters", () => {
    const surveys = [
      { id: "survey1", name: "Survey 1" },
      {
        id: "survey2",
        name: "Survey 2",
        segment: {
          id: "segment2",
          filters: [
            {
              id: "filter1",
              connector: null,
              resource: {
                root: { type: "attribute", contactAttributeKey: "attr-1" },
                id: "attr-filter-1",
                qualifier: { operator: "contains" },
                value: "attr",
              },
            },
          ],
          createdAt: new Date(),
          description: "Segment description",
          environmentId: "env1",
          isPrivate: true,
          surveys: ["survey2"],
          updatedAt: new Date(),
          title: "Segment title",
        } as TSegment,
      },
    ] as TSurvey[];

    expect(anySurveyHasFilters(surveys)).toBe(true);
  });
});

describe("checkForInvalidImagesInQuestions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("does not throw error when no images are present", () => {
    const questions = [
      { id: "q1", type: TSurveyQuestionTypeEnum.OpenText },
      { id: "q2", type: TSurveyQuestionTypeEnum.MultipleChoiceSingle },
    ] as TSurveyQuestion[];

    expect(() => checkForInvalidImagesInQuestions(questions)).not.toThrow();
  });

  test("does not throw error when all images are valid", () => {
    vi.spyOn(fileValidation, "isValidImageFile").mockReturnValue(true);

    const questions = [
      { id: "q1", type: TSurveyQuestionTypeEnum.OpenText, imageUrl: "valid-image.jpg" },
      { id: "q2", type: TSurveyQuestionTypeEnum.MultipleChoiceSingle },
    ] as TSurveyQuestion[];

    expect(() => checkForInvalidImagesInQuestions(questions)).not.toThrow();
    expect(fileValidation.isValidImageFile).toHaveBeenCalledWith("valid-image.jpg");
  });

  test("throws error when question image is invalid", () => {
    vi.spyOn(fileValidation, "isValidImageFile").mockReturnValue(false);

    const questions = [
      { id: "q1", type: TSurveyQuestionTypeEnum.OpenText, imageUrl: "invalid-image.txt" },
    ] as TSurveyQuestion[];

    expect(() => checkForInvalidImagesInQuestions(questions)).toThrow(
      new InvalidInputError("Invalid image file in question 1")
    );
    expect(fileValidation.isValidImageFile).toHaveBeenCalledWith("invalid-image.txt");
  });

  test("throws error when picture selection question has no choices", () => {
    const questions = [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.PictureSelection,
      },
    ] as TSurveyQuestion[];

    expect(() => checkForInvalidImagesInQuestions(questions)).toThrow(
      new InvalidInputError("Choices missing for question 1")
    );
  });

  test("throws error when picture selection choice has invalid image", () => {
    vi.spyOn(fileValidation, "isValidImageFile").mockImplementation((url) => url === "valid-image.jpg");

    const questions = [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.PictureSelection,
        choices: [
          { id: "c1", imageUrl: "valid-image.jpg" },
          { id: "c2", imageUrl: "invalid-image.txt" },
        ],
      },
    ] as TSurveyQuestion[];

    expect(() => checkForInvalidImagesInQuestions(questions)).toThrow(
      new InvalidInputError("Invalid image file for choice 2 in question 1")
    );

    expect(fileValidation.isValidImageFile).toHaveBeenCalledTimes(2);
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(1, "valid-image.jpg");
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(2, "invalid-image.txt");
  });

  test("validates all choices in picture selection questions", () => {
    vi.spyOn(fileValidation, "isValidImageFile").mockReturnValue(true);

    const questions = [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.PictureSelection,
        choices: [
          { id: "c1", imageUrl: "image1.jpg" },
          { id: "c2", imageUrl: "image2.jpg" },
          { id: "c3", imageUrl: "image3.jpg" },
        ],
      },
    ] as TSurveyQuestion[];

    expect(() => checkForInvalidImagesInQuestions(questions)).not.toThrow();
    expect(fileValidation.isValidImageFile).toHaveBeenCalledTimes(3);
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(1, "image1.jpg");
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(2, "image2.jpg");
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(3, "image3.jpg");
  });
});
