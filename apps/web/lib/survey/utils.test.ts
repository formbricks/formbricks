import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { TJsEnvironmentStateSurvey } from "@formbricks/types/js";
import { TSegment } from "@formbricks/types/segment";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey, TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import * as videoValidation from "@/lib/utils/video-upload";
import * as fileValidation from "@/modules/storage/utils";
import {
  anySurveyHasFilters,
  checkForInvalidImagesInQuestions,
  checkForInvalidMediaInBlocks,
  transformPrismaSurvey,
} from "./utils";

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

describe("checkForInvalidMediaInBlocks", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("returns ok when blocks array is empty", () => {
    const blocks: TSurveyBlock[] = [];

    const result = checkForInvalidMediaInBlocks(blocks);

    expect(result.ok).toBe(true);
  });

  test("returns ok when blocks have no images", () => {
    const blocks: TSurveyBlock[] = [
      {
        id: "block-1",
        name: "Block 1",
        elements: [
          {
            id: "elem-1",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { default: "Question" },
            required: false,
            inputType: "text",
          } as unknown as TSurveyElement,
        ],
      },
    ];

    const result = checkForInvalidMediaInBlocks(blocks);

    expect(result.ok).toBe(true);
  });

  test("returns ok when all element images are valid", () => {
    vi.spyOn(fileValidation, "isValidImageFile").mockReturnValue(true);

    const blocks: TSurveyBlock[] = [
      {
        id: "block-1",
        name: "Block 1",
        elements: [
          {
            id: "elem-1",
            type: TSurveyElementTypeEnum.PictureSelection,
            headline: { default: "Question" },
            required: false,
            choices: [
              { id: "c1", label: { default: "Option 1" }, imageUrl: "image1.jpg" },
              { id: "c2", label: { default: "Option 2" }, imageUrl: "image2.jpg" },
            ],
          } as unknown as TSurveyElement,
        ],
      },
    ];

    const result = checkForInvalidMediaInBlocks(blocks);

    expect(result.ok).toBe(true);
    expect(fileValidation.isValidImageFile).toHaveBeenCalledWith("image1.jpg");
    expect(fileValidation.isValidImageFile).toHaveBeenCalledWith("image2.jpg");
  });

  test("returns error when element image is invalid", () => {
    vi.spyOn(fileValidation, "isValidImageFile").mockReturnValue(false);

    const blocks: TSurveyBlock[] = [
      {
        id: "block-1",
        name: "Welcome Block",
        elements: [
          {
            id: "welcome",
            type: TSurveyElementTypeEnum.PictureSelection,
            headline: { default: "Welcome" },
            required: false,
            choices: [
              { id: "c1", label: { default: "Option 1" }, imageUrl: "image1.jpg" },
              { id: "c2", label: { default: "Option 2" }, imageUrl: "image2.jpg" },
            ],
          } as unknown as TSurveyElement,
        ],
      },
    ];

    const result = checkForInvalidMediaInBlocks(blocks);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe(
        'Invalid image URL in choice 1 of question 1 of block "Welcome Block"'
      );
    }
    expect(fileValidation.isValidImageFile).toHaveBeenCalledWith("image1.jpg");
  });

  test("returns ok when all choice images are valid", () => {
    vi.spyOn(fileValidation, "isValidImageFile").mockReturnValue(true);

    const blocks: TSurveyBlock[] = [
      {
        id: "block-1",
        name: "Choice Block",
        elements: [
          {
            id: "choice-q",
            type: TSurveyElementTypeEnum.PictureSelection,
            headline: { default: "Pick one" },
            required: true,
            choices: [
              { id: "c1", imageUrl: "image1.jpg" },
              { id: "c2", imageUrl: "image2.jpg" },
            ],
          } as unknown as TSurveyElement,
        ],
      },
    ];

    const result = checkForInvalidMediaInBlocks(blocks);

    expect(result.ok).toBe(true);
    expect(fileValidation.isValidImageFile).toHaveBeenCalledTimes(2);
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(1, "image1.jpg");
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(2, "image2.jpg");
  });

  test("returns error when choice image is invalid", () => {
    vi.spyOn(fileValidation, "isValidImageFile").mockImplementation((url) => url === "valid.jpg");

    const blocks: TSurveyBlock[] = [
      {
        id: "block-1",
        name: "Picture Selection",
        elements: [
          {
            id: "pic-select",
            type: TSurveyElementTypeEnum.PictureSelection,
            headline: { default: "Select a picture" },
            required: true,
            choices: [
              { id: "c1", imageUrl: "valid.jpg" },
              { id: "c2", imageUrl: "invalid.txt" },
            ],
          } as unknown as TSurveyElement,
        ],
      },
    ];

    const result = checkForInvalidMediaInBlocks(blocks);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe(
        'Invalid image URL in choice 2 of question 1 of block "Picture Selection"'
      );
    }
  });

  test("returns ok when video URL is valid (YouTube)", () => {
    vi.spyOn(videoValidation, "isValidVideoUrl").mockReturnValue(true);

    const blocks: TSurveyBlock[] = [
      {
        id: "block-1",
        name: "Video Block",
        elements: [
          {
            id: "video-q",
            type: TSurveyElementTypeEnum.CTA,
            headline: { default: "Watch this" },
            required: false,
            videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          } as unknown as TSurveyElement,
        ],
      },
    ];

    const result = checkForInvalidMediaInBlocks(blocks);

    expect(result.ok).toBe(true);
    expect(videoValidation.isValidVideoUrl).toHaveBeenCalledWith(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );
  });

  test("returns error when video URL is invalid (not YouTube/Vimeo/Loom)", () => {
    vi.spyOn(videoValidation, "isValidVideoUrl").mockReturnValue(false);

    const blocks: TSurveyBlock[] = [
      {
        id: "block-1",
        name: "Video Block",
        elements: [
          {
            id: "video-q",
            type: TSurveyElementTypeEnum.CTA,
            headline: { default: "Watch this" },
            required: false,
            videoUrl: "https://example.com/video.mp4",
          } as unknown as TSurveyElement,
        ],
      },
    ];

    const result = checkForInvalidMediaInBlocks(blocks);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Invalid video URL");
      expect(result.error.message).toContain("question 1");
      expect(result.error.message).toContain("YouTube, Vimeo, and Loom");
    }
  });

  test("validates images across multiple blocks", () => {
    vi.spyOn(fileValidation, "isValidImageFile").mockReturnValue(true);

    const blocks: TSurveyBlock[] = [
      {
        id: "block-1",
        name: "Block 1",
        elements: [
          {
            id: "elem-1",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { default: "Q1" },
            required: false,
            inputType: "text",
            imageUrl: "image1.jpg",
          } as unknown as TSurveyElement,
        ],
      },
      {
        id: "block-2",
        name: "Block 2",
        elements: [
          {
            id: "elem-2",
            type: TSurveyElementTypeEnum.Rating,
            headline: { default: "Q2" },
            required: true,
            range: 5,
            scale: "star",
            imageUrl: "image2.jpg",
          } as unknown as TSurveyElement,
        ],
      },
    ];

    const result = checkForInvalidMediaInBlocks(blocks);

    expect(result.ok).toBe(true);
    expect(fileValidation.isValidImageFile).toHaveBeenCalledTimes(2);
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(1, "image1.jpg");
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(2, "image2.jpg");
  });

  test("stops at first invalid image and returns specific error", () => {
    vi.spyOn(fileValidation, "isValidImageFile").mockImplementation((url) => url !== "bad-image.gif");

    const blocks: TSurveyBlock[] = [
      {
        id: "block-1",
        name: "Block 1",
        elements: [
          {
            id: "elem-1",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { default: "Q1" },
            required: false,
            inputType: "text",
            imageUrl: "good.jpg",
          } as unknown as TSurveyElement,
        ],
      },
      {
        id: "block-2",
        name: "Block 2",
        elements: [
          {
            id: "elem-2",
            type: TSurveyElementTypeEnum.CTA,
            headline: { default: "Q2" },
            required: false,
            imageUrl: "bad-image.gif",
          } as unknown as TSurveyElement,
          {
            id: "elem-3",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { default: "Q3" },
            required: false,
            inputType: "text",
            imageUrl: "another.jpg",
          } as unknown as TSurveyElement,
        ],
      },
    ];

    const result = checkForInvalidMediaInBlocks(blocks);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe('Invalid image URL in question 1 of block "Block 2" (block 2)');
    }
    // Should stop after finding first invalid image
    expect(fileValidation.isValidImageFile).toHaveBeenCalledTimes(2);
  });

  test("validates choices without imageUrl (skips gracefully)", () => {
    vi.spyOn(fileValidation, "isValidImageFile").mockReturnValue(true);

    const blocks: TSurveyBlock[] = [
      {
        id: "block-1",
        name: "Choice Block",
        elements: [
          {
            id: "mc-q",
            type: TSurveyElementTypeEnum.PictureSelection,
            headline: { default: "Pick one" },
            required: true,
            choices: [{ id: "c1", imageUrl: "image.jpg" }],
          } as unknown as TSurveyElement,
        ],
      },
    ];

    const result = checkForInvalidMediaInBlocks(blocks);

    expect(result.ok).toBe(true);
    // Only validates the one with imageUrl
    expect(fileValidation.isValidImageFile).toHaveBeenCalledTimes(1);
    expect(fileValidation.isValidImageFile).toHaveBeenCalledWith("image.jpg");
  });

  test("handles multiple elements in single block", () => {
    vi.spyOn(fileValidation, "isValidImageFile").mockReturnValue(true);

    const blocks: TSurveyBlock[] = [
      {
        id: "block-1",
        name: "Multi-Element Block",
        elements: [
          {
            id: "elem-1",
            type: TSurveyElementTypeEnum.OpenText,
            headline: { default: "Q1" },
            required: false,
            inputType: "text",
            imageUrl: "img1.jpg",
          } as unknown as TSurveyElement,
          {
            id: "elem-2",
            type: TSurveyElementTypeEnum.Rating,
            headline: { default: "Q2" },
            required: true,
            range: 5,
            scale: "number",
            imageUrl: "img2.jpg",
          } as unknown as TSurveyElement,
          {
            id: "elem-3",
            type: TSurveyElementTypeEnum.CTA,
            headline: { default: "Q3" },
            required: false,
            imageUrl: "img3.jpg",
          } as unknown as TSurveyElement,
        ],
      },
    ];

    const result = checkForInvalidMediaInBlocks(blocks);

    expect(result.ok).toBe(true);
    expect(fileValidation.isValidImageFile).toHaveBeenCalledTimes(3);
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(1, "img1.jpg");
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(2, "img2.jpg");
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(3, "img3.jpg");
  });

  test("validates both element imageUrl and choice imageUrls", () => {
    vi.spyOn(fileValidation, "isValidImageFile").mockReturnValue(true);

    const blocks: TSurveyBlock[] = [
      {
        id: "block-1",
        name: "Complex Block",
        elements: [
          {
            id: "elem-1",
            type: TSurveyElementTypeEnum.PictureSelection,
            headline: { default: "Choose" },
            required: true,
            imageUrl: "element-image.jpg",
            choices: [
              { id: "c1", imageUrl: "choice1.jpg" },
              { id: "c2", imageUrl: "choice2.jpg" },
            ],
          } as unknown as TSurveyElement,
        ],
      },
    ];

    const result = checkForInvalidMediaInBlocks(blocks);

    expect(result.ok).toBe(true);
    expect(fileValidation.isValidImageFile).toHaveBeenCalledTimes(3);
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(1, "element-image.jpg");
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(2, "choice1.jpg");
    expect(fileValidation.isValidImageFile).toHaveBeenNthCalledWith(3, "choice2.jpg");
  });
});
