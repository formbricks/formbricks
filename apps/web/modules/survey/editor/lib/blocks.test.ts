import { describe, expect, test } from "vitest";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  addBlock,
  addElementToBlock,
  deleteBlock,
  deleteElementFromBlock,
  duplicateBlock,
  duplicateElementInBlock,
  isElementIdUnique,
  moveBlock,
  updateBlock,
  updateElementInBlock,
} from "./blocks";

// Helper to create a mock survey
const createMockSurvey = (): TSurvey => ({
  id: "test-survey-id",
  name: "Test Survey",
  type: "link",
  environmentId: "test-env-id",
  createdBy: null,
  status: "draft",
  welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },
  questions: [],
  endings: [],
  hiddenFields: { enabled: false },
  variables: [],
  displayOption: "displayOnce",
  recontactDays: null,
  displayLimit: null,
  autoClose: null,
  delay: 0,
  displayPercentage: null,
  autoComplete: null,
  isVerifyEmailEnabled: false,
  isSingleResponsePerEmailEnabled: false,
  projectOverwrites: null,
  styling: null,
  surveyClosedMessage: null,
  singleUse: null,
  pin: null,
  languages: [],
  showLanguageSwitch: null,
  segment: null,
  triggers: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  blocks: [
    {
      id: "block-1",
      name: "Block 1",
      elements: [
        {
          id: "elem-1",
          type: TSurveyElementTypeEnum.OpenText,
          headline: { default: "Question 1" },
          required: true,
          inputType: "text",
        } as any,
        {
          id: "elem-2",
          type: TSurveyElementTypeEnum.OpenText,
          headline: { default: "Question 2" },
          required: false,
          inputType: "email",
        } as any,
      ],
    },
    {
      id: "block-2",
      name: "Block 2",
      elements: [
        {
          id: "elem-3",
          type: TSurveyElementTypeEnum.Rating,
          headline: { default: "Rate us" },
          required: true,
          scale: "star",
          range: 5,
        } as any,
      ],
    },
  ],
  followUps: [],
  recaptcha: null,
  isBackButtonHidden: false,
  metadata: {},
});

describe("Block Utility Functions", () => {
  describe("isElementIdUnique", () => {
    test("should return true for unique element ID", () => {
      const survey = createMockSurvey();
      const isUnique = isElementIdUnique("new-elem", survey.blocks);
      expect(isUnique).toBe(true);
    });

    test("should return false for duplicate element ID", () => {
      const survey = createMockSurvey();
      const isUnique = isElementIdUnique("elem-1", survey.blocks);
      expect(isUnique).toBe(false);
    });

    test("should skip current block when provided", () => {
      const survey = createMockSurvey();
      const isUnique = isElementIdUnique("elem-1", survey.blocks, "block-1");
      expect(isUnique).toBe(true); // Skips block-1 where elem-1 exists
    });
  });
});

describe("Block Operations", () => {
  describe("addBlock", () => {
    test("should add a block to the end by default", () => {
      const survey = createMockSurvey();
      const result = addBlock(survey, { name: "Block 3", elements: [] });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks.length).toBe(3);
        expect(result.data.blocks[2].name).toBe("Block 3");
        expect(result.data.blocks[2].id).toBeTruthy();
      }
    });

    test("should add a block at specific index", () => {
      const survey = createMockSurvey();
      const result = addBlock(survey, { name: "Block 1.5", elements: [] }, 1);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks.length).toBe(3);
        expect(result.data.blocks[1].name).toBe("Block 1.5");
      }
    });

    test("should return error for invalid index", () => {
      const survey = createMockSurvey();
      const result = addBlock(survey, { name: "Block X", elements: [] }, 10);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("Invalid index");
      }
    });

    test("should use default name if not provided", () => {
      const survey = createMockSurvey();
      const result = addBlock(survey, { elements: [] });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks[2].name).toBe("Untitled Block");
      }
    });
  });

  describe("updateBlock", () => {
    test("should update block attributes", () => {
      const survey = createMockSurvey();
      const result = updateBlock(survey, "block-1", { name: "Updated Block 1" });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks[0].name).toBe("Updated Block 1");
      }
    });

    test("should return error for non-existent block", () => {
      const survey = createMockSurvey();
      const result = updateBlock(survey, "non-existent", { name: "Updated" });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("not found");
      }
    });
  });

  describe("deleteBlock", () => {
    test("should delete a block", () => {
      const survey = createMockSurvey();
      const result = deleteBlock(survey, "block-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks.length).toBe(1);
        expect(result.data.blocks[0].id).toBe("block-2");
      }
    });

    test("should return error for non-existent block", () => {
      const survey = createMockSurvey();
      const result = deleteBlock(survey, "non-existent");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("not found");
      }
    });
  });

  describe("duplicateBlock", () => {
    test("should duplicate a block with new IDs", () => {
      const survey = createMockSurvey();
      const result = duplicateBlock(survey, "block-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks.length).toBe(3);
        const duplicated = result.data.blocks[1];
        expect(duplicated.name).toBe("Block 1 (copy)");
        expect(duplicated.id).not.toBe("block-1");
        expect(duplicated.elements.length).toBe(2);
        // Element IDs should be different
        expect(duplicated.elements[0].id).not.toBe("elem-1");
      }
    });

    test("should clear logic on duplicated block", () => {
      const survey = createMockSurvey();
      survey.blocks[0].logic = [
        {
          id: "logic-1",
          conditions: { connector: "and", conditions: [] },
          actions: [],
        },
      ] as any;

      const result = duplicateBlock(survey, "block-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks[1].logic).toBeUndefined();
      }
    });
  });

  describe("moveBlock", () => {
    test("should move block down", () => {
      const survey = createMockSurvey();
      const result = moveBlock(survey, "block-1", "down");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks[0].id).toBe("block-2");
        expect(result.data.blocks[1].id).toBe("block-1");
      }
    });

    test("should move block up", () => {
      const survey = createMockSurvey();
      const result = moveBlock(survey, "block-2", "up");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks[0].id).toBe("block-2");
        expect(result.data.blocks[1].id).toBe("block-1");
      }
    });

    test("should return unchanged survey when moving first block up", () => {
      const survey = createMockSurvey();
      const result = moveBlock(survey, "block-1", "up");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks[0].id).toBe("block-1");
      }
    });

    test("should return unchanged survey when moving last block down", () => {
      const survey = createMockSurvey();
      const result = moveBlock(survey, "block-2", "down");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks[1].id).toBe("block-2");
      }
    });
  });
});

describe("Element Operations", () => {
  describe("addElementToBlock", () => {
    test("should add element to block", () => {
      const survey = createMockSurvey();
      const newElement = {
        id: "elem-new",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "New Question" },
        required: false,
        inputType: "text",
      } as any;

      const result = addElementToBlock(survey, "block-1", newElement);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks[0].elements.length).toBe(3);
        expect(result.data.blocks[0].elements[2].id).toBe("elem-new");
        expect(result.data.blocks[0].elements[2].isDraft).toBe(true);
      }
    });

    test("should return error for duplicate element ID", () => {
      const survey = createMockSurvey();
      const duplicateElement = {
        id: "elem-1", // Already exists
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Duplicate" },
        required: false,
        inputType: "text",
      } as any;

      const result = addElementToBlock(survey, "block-2", duplicateElement);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("already exists");
      }
    });

    test("should return error for duplicate element ID within same block", () => {
      const survey = createMockSurvey();
      const duplicateElement = {
        id: "elem-1", // Already exists in block-1
        type: TSurveyElementTypeEnum.Rating,
        headline: { default: "Duplicate in same block" },
        required: false,
        range: 5,
        scale: "star",
      } as any;

      // Try to add to the same block where elem-1 already exists
      const result = addElementToBlock(survey, "block-1", duplicateElement);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("already exists");
      }
    });

    test("should return error for non-existent block", () => {
      const survey = createMockSurvey();
      const element = {
        id: "elem-new",
        type: TSurveyElementTypeEnum.OpenText,
        headline: { default: "Question" },
        required: false,
        inputType: "text",
      } as any;

      const result = addElementToBlock(survey, "non-existent", element);

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("not found");
      }
    });
  });

  describe("updateElementInBlock", () => {
    test("should update element attributes", () => {
      const survey = createMockSurvey();
      const result = updateElementInBlock(survey, "block-1", "elem-1", {
        headline: { default: "Updated Question" },
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks![0].elements[0].headline.default).toBe("Updated Question");
      }
    });

    test("should allow updating element ID to a unique ID", () => {
      const survey = createMockSurvey();
      const result = updateElementInBlock(survey, "block-1", "elem-1", {
        id: "elem-new-id",
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks![0].elements[0].id).toBe("elem-new-id");
      }
    });

    test("should return error when updating element ID to duplicate within same block", () => {
      const survey = createMockSurvey();
      const result = updateElementInBlock(survey, "block-1", "elem-1", {
        id: "elem-2", // elem-2 already exists in block-1
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("already exists");
      }
    });

    test("should return error when updating element ID to duplicate in another block", () => {
      const survey = createMockSurvey();
      const result = updateElementInBlock(survey, "block-1", "elem-1", {
        id: "elem-3", // elem-3 exists in block-2
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("already exists");
      }
    });

    test("should return error for non-existent element", () => {
      const survey = createMockSurvey();
      const result = updateElementInBlock(survey, "block-1", "non-existent", {
        headline: { default: "Updated" },
      });

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("not found");
      }
    });
  });

  describe("deleteElementFromBlock", () => {
    test("should delete element from block", () => {
      const survey = createMockSurvey();
      const result = deleteElementFromBlock(survey, "block-1", "elem-2");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks[0].elements.length).toBe(1);
        expect(result.data.blocks[0].elements[0].id).toBe("elem-1");
      }
    });

    test("should return error for non-existent element", () => {
      const survey = createMockSurvey();
      const result = deleteElementFromBlock(survey, "block-1", "non-existent");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("not found");
      }
    });
  });

  describe("duplicateElementInBlock", () => {
    test("should duplicate element with new ID", () => {
      const survey = createMockSurvey();
      const result = duplicateElementInBlock(survey, "block-1", "elem-1");

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.data.blocks[0].elements.length).toBe(3);
        const duplicated = result.data.blocks![0].elements[1];
        expect(duplicated.id).not.toBe("elem-1");
        expect(duplicated.isDraft).toBe(true);
        expect(duplicated.headline.default).toBe("Question 1");
      }
    });

    test("should return error for non-existent element", () => {
      const survey = createMockSurvey();
      const result = duplicateElementInBlock(survey, "block-1", "non-existent");

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("not found");
      }
    });
  });
});
