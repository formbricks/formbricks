import { describe, expect, test, vi } from "vitest";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyElement, TSurveyElementTypeEnum } from "@formbricks/types/surveys/elements";
import { TSurvey } from "@formbricks/types/surveys/types";
import {
  addBlock,
  addElementToBlock,
  deleteBlock,
  deleteElementFromBlock,
  duplicateBlock,
  duplicateElementInBlock,
  findElementLocation,
  isElementIdUnique,
  moveBlock,
  moveElementInBlock,
  renumberBlocks,
  updateBlock,
  updateElementInBlock,
} from "./blocks";

vi.mock("@paralleldrive/cuid2", () => ({
  createId: vi.fn(() => "test-cuid-" + Math.random().toString(36).substring(7)),
}));

const mockT = ((key: string) => key) as never;

const createMockElement = (id: string): TSurveyElement => ({
  id,
  type: TSurveyElementTypeEnum.OpenText,
  headline: { default: "Test Question" },
  required: false,
  inputType: "text",
  longAnswer: true,
  charLimit: { enabled: false },
});

const createMockBlock = (id: string, name: string, elements: TSurveyElement[] = []): TSurveyBlock => ({
  id,
  name,
  elements,
});

const createMockSurvey = (blocks: TSurveyBlock[] = []): TSurvey => ({
  id: "survey-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  name: "Test Survey",
  type: "link",
  environmentId: "env-1",
  createdBy: null,
  status: "draft",
  displayOption: "respondMultiple",
  autoClose: null,
  triggers: [],
  recontactDays: null,
  displayLimit: null,
  welcomeCard: {
    enabled: false,
    headline: { default: "Welcome" },
    timeToFinish: false,
    showResponseCount: false,
  },
  questions: [],
  blocks,
  endings: [],
  hiddenFields: { enabled: false, fieldIds: [] },
  variables: [],
  styling: null,
  segment: null,
  languages: [],
  displayPercentage: null,
  isVerifyEmailEnabled: false,
  isSingleResponsePerEmailEnabled: false,
  singleUse: null,
  pin: null,
  projectOverwrites: null,
  surveyClosedMessage: null,
  followUps: [],
  delay: 0,
  autoComplete: null,
  showLanguageSwitch: null,
  recaptcha: null,
  isBackButtonHidden: false,
  metadata: {},
});

describe("renumberBlocks", () => {
  test("should renumber blocks sequentially starting from 1", () => {
    const blocks = [
      createMockBlock("block-1", "Old Name 1"),
      createMockBlock("block-2", "Old Name 2"),
      createMockBlock("block-3", "Old Name 3"),
    ];

    const result = renumberBlocks(blocks);

    expect(result).toHaveLength(3);
    expect(result[0].name).toBe("Block 1");
    expect(result[1].name).toBe("Block 2");
    expect(result[2].name).toBe("Block 3");
  });

  test("should preserve block IDs and other properties", () => {
    const blocks = [
      createMockBlock("block-1", "Old Name 1", [createMockElement("q1")]),
      createMockBlock("block-2", "Old Name 2", [createMockElement("q2")]),
    ];

    const result = renumberBlocks(blocks);

    expect(result[0].id).toBe("block-1");
    expect(result[1].id).toBe("block-2");
    expect(result[0].elements).toHaveLength(1);
    expect(result[1].elements).toHaveLength(1);
  });

  test("should handle empty array", () => {
    const result = renumberBlocks([]);
    expect(result).toHaveLength(0);
  });

  test("should handle single block", () => {
    const blocks = [createMockBlock("block-1", "Old Name")];
    const result = renumberBlocks(blocks);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Block 1");
  });
});

describe("isElementIdUnique", () => {
  test("should return true for a unique element ID", () => {
    const blocks = [
      createMockBlock("block-1", "Block 1", [createMockElement("q1")]),
      createMockBlock("block-2", "Block 2", [createMockElement("q2")]),
    ];

    expect(isElementIdUnique("q3", blocks)).toBe(true);
  });

  test("should return false for a duplicate element ID", () => {
    const blocks = [
      createMockBlock("block-1", "Block 1", [createMockElement("q1")]),
      createMockBlock("block-2", "Block 2", [createMockElement("q2")]),
    ];

    expect(isElementIdUnique("q1", blocks)).toBe(false);
    expect(isElementIdUnique("q2", blocks)).toBe(false);
  });

  test("should return true for empty blocks", () => {
    expect(isElementIdUnique("q1", [])).toBe(true);
  });
});

describe("findElementLocation", () => {
  test("should find element location correctly", () => {
    const element1 = createMockElement("q1");
    const element2 = createMockElement("q2");
    const block1 = createMockBlock("block-1", "Block 1", [element1]);
    const block2 = createMockBlock("block-2", "Block 2", [element2]);
    const survey = createMockSurvey([block1, block2]);

    const result = findElementLocation(survey, "q2");

    expect(result.blockId).toBe("block-2");
    expect(result.blockIndex).toBe(1);
    expect(result.elementIndex).toBe(0);
    expect(result.block).toEqual(block2);
  });

  test("should return null values when element is not found", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1", [createMockElement("q1")])]);

    const result = findElementLocation(survey, "nonexistent");

    expect(result.blockId).toBe(null);
    expect(result.blockIndex).toBe(-1);
    expect(result.elementIndex).toBe(-1);
    expect(result.block).toBe(null);
  });

  test("should find element in the middle of multiple elements", () => {
    const elements = [createMockElement("q1"), createMockElement("q2"), createMockElement("q3")];
    const block = createMockBlock("block-1", "Block 1", elements);
    const survey = createMockSurvey([block]);

    const result = findElementLocation(survey, "q2");

    expect(result.blockId).toBe("block-1");
    expect(result.blockIndex).toBe(0);
    expect(result.elementIndex).toBe(1);
  });
});

describe("addBlock", () => {
  test("should add a block to empty survey", () => {
    const survey = createMockSurvey([]);
    const result = addBlock(mockT, survey, { name: "Block 1" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks).toHaveLength(1);
      expect(result.data.blocks[0].name).toBe("Block 1");
      expect(result.data.blocks[0].elements).toEqual([]);
    }
  });

  test("should append block to end by default", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1")]);
    const result = addBlock(mockT, survey, { name: "Block 2" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks).toHaveLength(2);
      expect(result.data.blocks[1].name).toBe("Block 2");
    }
  });

  test("should insert block at specific index", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1"),
      createMockBlock("block-2", "Block 2"),
    ]);
    const result = addBlock(mockT, survey, { name: "Block 1.5" }, 1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks).toHaveLength(3);
      expect(result.data.blocks[1].name).toBe("Block 2");
      expect(result.data.blocks[0].name).toBe("Block 1");
      expect(result.data.blocks[2].name).toBe("Block 3");
    }
  });

  test("should return error for invalid index", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1")]);
    const result = addBlock(mockT, survey, { name: "Invalid" }, 10);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Invalid index");
    }
  });

  test("should return error for negative index", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1")]);
    const result = addBlock(mockT, survey, { name: "Invalid" }, -1);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Invalid index");
    }
  });
});

describe("updateBlock", () => {
  test("should update block name", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Old Name")]);
    const result = updateBlock(survey, "block-1", { name: "New Name" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].name).toBe("New Name");
    }
  });

  test("should update multiple block attributes", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1")]);
    const result = updateBlock(survey, "block-1", {
      name: "Updated",
      buttonLabel: { default: "Next" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].name).toBe("Updated");
      expect(result.data.blocks[0].buttonLabel).toEqual({ default: "Next" });
    }
  });

  test("should return error when block not found", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1")]);
    const result = updateBlock(survey, "nonexistent", { name: "Updated" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Block with ID "nonexistent" not found');
    }
  });

  test("should return error when trying to update id", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1")]);
    const result = updateBlock(survey, "block-1", { id: "new-id" } as any);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Block ID cannot be updated");
    }
  });
});

describe("deleteBlock", () => {
  test("should delete a block", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1"),
      createMockBlock("block-2", "Block 2"),
    ]);
    const result = deleteBlock(survey, "block-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks).toHaveLength(1);
      expect(result.data.blocks[0].id).toBe("block-2");
    }
  });

  test("should return error when trying to delete the last block", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1")]);
    const result = deleteBlock(survey, "block-1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toBe("Cannot delete the last block in the survey");
    }
  });

  test("should return error when block not found", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1"),
      createMockBlock("block-2", "Block 2"),
    ]);
    const result = deleteBlock(survey, "nonexistent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Block with ID "nonexistent" not found');
    }
  });

  test("should handle deleting from empty survey", () => {
    const survey = createMockSurvey([]);
    const result = deleteBlock(survey, "block-1");

    expect(result.ok).toBe(false);
  });
});

describe("duplicateBlock", () => {
  test("should duplicate a block with new IDs", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1", [createMockElement("q1"), createMockElement("q2")]),
    ]);
    const result = duplicateBlock(survey, "block-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks).toHaveLength(2);
      expect(result.data.blocks[1].name).toBe("Block 2");
      expect(result.data.blocks[1].id).not.toBe("block-1");
      expect(result.data.blocks[1].elements[0].id).not.toBe("q1");
      expect(result.data.blocks[1].elements[1].id).not.toBe("q2");
      expect(result.data.blocks[1].elements[0].isDraft).toBe(true);
      expect(result.data.blocks[1].elements[1].isDraft).toBe(true);
    }
  });

  test("should clear logic when duplicating", () => {
    const blockWithLogic = createMockBlock("block-1", "Block 1", [createMockElement("q1")]);
    blockWithLogic.logic = [
      {
        id: "logic-1",
        conditions: {
          id: "cond-1",
          connector: "and",
          conditions: [],
        },
        actions: [],
      },
    ];
    blockWithLogic.logicFallback = "block-2";

    const survey = createMockSurvey([blockWithLogic]);
    const result = duplicateBlock(survey, "block-1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[1].logic).toBeUndefined();
      expect(result.data.blocks[1].logicFallback).toBeUndefined();
    }
  });

  test("should insert duplicate after original block", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1"),
      createMockBlock("block-2", "Block 2"),
      createMockBlock("block-3", "Block 3"),
    ]);
    const result = duplicateBlock(survey, "block-2");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks).toHaveLength(4);
      expect(result.data.blocks[2].name).toBe("Block 3");
      expect(result.data.blocks[1].id).toBe("block-2");
      expect(result.data.blocks[3].id).toBe("block-3");
    }
  });

  test("should return error when block not found", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1")]);
    const result = duplicateBlock(survey, "nonexistent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Block with ID "nonexistent" not found');
    }
  });
});

describe("moveBlock", () => {
  test("should move block up", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1"),
      createMockBlock("block-2", "Block 2"),
      createMockBlock("block-3", "Block 3"),
    ]);
    const result = moveBlock(survey, "block-2", "up");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].id).toBe("block-2");
      expect(result.data.blocks[1].id).toBe("block-1");
      expect(result.data.blocks[2].id).toBe("block-3");
    }
  });

  test("should move block down", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1"),
      createMockBlock("block-2", "Block 2"),
      createMockBlock("block-3", "Block 3"),
    ]);
    const result = moveBlock(survey, "block-2", "down");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].id).toBe("block-1");
      expect(result.data.blocks[1].id).toBe("block-3");
      expect(result.data.blocks[2].id).toBe("block-2");
    }
  });

  test("should not move first block up", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1"),
      createMockBlock("block-2", "Block 2"),
    ]);
    const result = moveBlock(survey, "block-1", "up");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].id).toBe("block-1");
      expect(result.data.blocks[1].id).toBe("block-2");
    }
  });

  test("should not move last block down", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1"),
      createMockBlock("block-2", "Block 2"),
    ]);
    const result = moveBlock(survey, "block-2", "down");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].id).toBe("block-1");
      expect(result.data.blocks[1].id).toBe("block-2");
    }
  });

  test("should return error when block not found", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1")]);
    const result = moveBlock(survey, "nonexistent", "up");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Block with ID "nonexistent" not found');
    }
  });
});

describe("addElementToBlock", () => {
  test("should add element to block", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1")]);
    const element = createMockElement("q1");
    const result = addElementToBlock(survey, "block-1", element);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].elements).toHaveLength(1);
      expect(result.data.blocks[0].elements[0].id).toBe("q1");
      expect(result.data.blocks[0].elements[0].isDraft).toBe(true);
    }
  });

  test("should append element to end by default", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1", [createMockElement("q1"), createMockElement("q2")]),
    ]);
    const element = createMockElement("q3");
    const result = addElementToBlock(survey, "block-1", element);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].elements).toHaveLength(3);
      expect(result.data.blocks[0].elements[2].id).toBe("q3");
    }
  });

  test("should insert element at specific index", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1", [createMockElement("q1"), createMockElement("q2")]),
    ]);
    const element = createMockElement("q1.5");
    const result = addElementToBlock(survey, "block-1", element, 1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].elements).toHaveLength(3);
      expect(result.data.blocks[0].elements[1].id).toBe("q1.5");
      expect(result.data.blocks[0].elements[0].id).toBe("q1");
      expect(result.data.blocks[0].elements[2].id).toBe("q2");
    }
  });

  test("should return error for duplicate element ID", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1", [createMockElement("q1")]),
      createMockBlock("block-2", "Block 2", [createMockElement("q2")]),
    ]);
    const element = createMockElement("q1");
    const result = addElementToBlock(survey, "block-2", element);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Element ID "q1" already exists');
    }
  });

  test("should return error when block not found", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1")]);
    const element = createMockElement("q1");
    const result = addElementToBlock(survey, "nonexistent", element);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Block with ID "nonexistent" not found');
    }
  });

  test("should return error for invalid index", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1", [createMockElement("q1")])]);
    const element = createMockElement("q2");
    const result = addElementToBlock(survey, "block-1", element, 10);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Invalid index");
    }
  });
});

describe("updateElementInBlock", () => {
  test("should update element headline", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1", [createMockElement("q1")])]);
    const result = updateElementInBlock(survey, "block-1", "q1", {
      headline: { default: "Updated Question" },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].elements[0].headline).toEqual({ default: "Updated Question" });
    }
  });

  test("should update element ID if new ID is unique", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1", [createMockElement("q1")])]);
    const result = updateElementInBlock(survey, "block-1", "q1", { id: "q2" });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].elements[0].id).toBe("q2");
    }
  });

  test("should return error when updating to duplicate element ID", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1", [createMockElement("q1"), createMockElement("q2")]),
    ]);
    const result = updateElementInBlock(survey, "block-1", "q1", { id: "q2" });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Element ID "q2" already exists');
    }
  });

  test("should return error when block not found", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1", [createMockElement("q1")])]);
    const result = updateElementInBlock(survey, "nonexistent", "q1", {
      headline: { default: "Updated" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Block with ID "nonexistent" not found');
    }
  });

  test("should return error when element not found", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1", [createMockElement("q1")])]);
    const result = updateElementInBlock(survey, "block-1", "nonexistent", {
      headline: { default: "Updated" },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Element with ID "nonexistent" not found');
    }
  });
});

describe("deleteElementFromBlock", () => {
  test("should delete element from block", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1", [createMockElement("q1"), createMockElement("q2")]),
    ]);
    const result = deleteElementFromBlock(survey, "block-1", "q1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].elements).toHaveLength(1);
      expect(result.data.blocks[0].elements[0].id).toBe("q2");
    }
  });

  test("should return error when block not found", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1", [createMockElement("q1")])]);
    const result = deleteElementFromBlock(survey, "nonexistent", "q1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Block with ID "nonexistent" not found');
    }
  });

  test("should return error when element not found", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1", [createMockElement("q1")])]);
    const result = deleteElementFromBlock(survey, "block-1", "nonexistent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Element with ID "nonexistent" not found');
    }
  });
});

describe("duplicateElementInBlock", () => {
  test("should duplicate element with new ID", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1", [createMockElement("q1")])]);
    const result = duplicateElementInBlock(survey, "block-1", "q1");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].elements).toHaveLength(2);
      expect(result.data.blocks[0].elements[1].id).not.toBe("q1");
      expect(result.data.blocks[0].elements[1].isDraft).toBe(true);
      expect(result.data.blocks[0].elements[1].headline).toEqual({ default: "Test Question" });
    }
  });

  test("should insert duplicate after original element", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1", [
        createMockElement("q1"),
        createMockElement("q2"),
        createMockElement("q3"),
      ]),
    ]);
    const result = duplicateElementInBlock(survey, "block-1", "q2");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].elements).toHaveLength(4);
      expect(result.data.blocks[0].elements[1].id).toBe("q2");
      expect(result.data.blocks[0].elements[2].id).not.toBe("q2");
      expect(result.data.blocks[0].elements[3].id).toBe("q3");
    }
  });

  test("should return error when block not found", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1", [createMockElement("q1")])]);
    const result = duplicateElementInBlock(survey, "nonexistent", "q1");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Block with ID "nonexistent" not found');
    }
  });

  test("should return error when element not found", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1", [createMockElement("q1")])]);
    const result = duplicateElementInBlock(survey, "block-1", "nonexistent");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Element with ID "nonexistent" not found');
    }
  });
});

describe("moveElementInBlock", () => {
  test("should move element up", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1", [
        createMockElement("q1"),
        createMockElement("q2"),
        createMockElement("q3"),
      ]),
    ]);
    const result = moveElementInBlock(survey, "block-1", "q2", "up");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].elements[0].id).toBe("q2");
      expect(result.data.blocks[0].elements[1].id).toBe("q1");
      expect(result.data.blocks[0].elements[2].id).toBe("q3");
    }
  });

  test("should move element down", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1", [
        createMockElement("q1"),
        createMockElement("q2"),
        createMockElement("q3"),
      ]),
    ]);
    const result = moveElementInBlock(survey, "block-1", "q2", "down");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].elements[0].id).toBe("q1");
      expect(result.data.blocks[0].elements[1].id).toBe("q3");
      expect(result.data.blocks[0].elements[2].id).toBe("q2");
    }
  });

  test("should not move first element up", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1", [createMockElement("q1"), createMockElement("q2")]),
    ]);
    const result = moveElementInBlock(survey, "block-1", "q1", "up");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].elements[0].id).toBe("q1");
      expect(result.data.blocks[0].elements[1].id).toBe("q2");
    }
  });

  test("should not move last element down", () => {
    const survey = createMockSurvey([
      createMockBlock("block-1", "Block 1", [createMockElement("q1"), createMockElement("q2")]),
    ]);
    const result = moveElementInBlock(survey, "block-1", "q2", "down");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.blocks[0].elements[0].id).toBe("q1");
      expect(result.data.blocks[0].elements[1].id).toBe("q2");
    }
  });

  test("should return error when block not found", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1", [createMockElement("q1")])]);
    const result = moveElementInBlock(survey, "nonexistent", "q1", "up");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Block with ID "nonexistent" not found');
    }
  });

  test("should return error when element not found", () => {
    const survey = createMockSurvey([createMockBlock("block-1", "Block 1", [createMockElement("q1")])]);
    const result = moveElementInBlock(survey, "block-1", "nonexistent", "up");

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain('Element with ID "nonexistent" not found');
    }
  });
});
