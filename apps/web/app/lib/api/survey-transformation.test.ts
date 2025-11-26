import { describe, expect, test } from "vitest";
import { InvalidInputError } from "@formbricks/types/errors";
import { TSurveyBlock } from "@formbricks/types/surveys/blocks";
import { TSurveyCTAElement } from "@formbricks/types/surveys/elements";
import { TSurveyQuestion, TSurveyQuestionTypeEnum } from "@formbricks/types/surveys/types";
import {
  transformBlocksToQuestions,
  transformQuestionsToBlocks,
  validateSurveyInput,
} from "./survey-transformation";

describe("validateSurveyInput", () => {
  test("should return error when both questions and blocks are provided", () => {
    const result = validateSurveyInput({
      questions: [{ id: "q1", type: TSurveyQuestionTypeEnum.OpenText }] as unknown as TSurveyQuestion[],
      blocks: [{ id: "b1", name: "Block 1", elements: [] }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(InvalidInputError);
    }
  });

  test("should return error when neither questions nor blocks are provided", () => {
    const result = validateSurveyInput({
      questions: [],
      blocks: [],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(InvalidInputError);
    }
  });

  test("should return ok when only questions are provided", () => {
    const result = validateSurveyInput({
      questions: [{ id: "q1", type: TSurveyQuestionTypeEnum.OpenText }] as unknown as TSurveyQuestion[],
      blocks: [],
    });
    expect(result.ok).toBe(true);
  });

  test("should return ok when only blocks are provided", () => {
    const result = validateSurveyInput({
      questions: [],
      blocks: [
        {
          id: "b1",
          name: "Block 1",
          elements: [{ id: "e1", type: TSurveyQuestionTypeEnum.OpenText }],
        } as unknown as TSurveyBlock,
      ],
    });
    expect(result.ok).toBe(true);
  });
});

describe("transformQuestionsToBlocks", () => {
  test("should return empty array for empty questions", () => {
    const blocks = transformQuestionsToBlocks([], []);
    expect(blocks).toEqual([]);
  });

  test("should convert a single question to a block with one element", () => {
    const questions = [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "What is your name?" },
        required: false,
        inputType: "text",
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    expect(blocks).toHaveLength(1);
    expect(blocks[0].name).toBe("Block 1");
    expect(blocks[0].elements).toHaveLength(1);
    expect(blocks[0].elements[0].id).toBe("q1");
    expect(blocks[0].elements[0].type).toBe("openText");
  });

  test("should convert multiple questions to multiple blocks", () => {
    const questions = [
      {
        id: "q1",
        type: TSurveyQuestionTypeEnum.OpenText,
        headline: { default: "Question 1" },
      },
      {
        id: "q2",
        type: TSurveyQuestionTypeEnum.MultipleChoiceSingle,
        headline: { default: "Question 2" },
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    expect(blocks).toHaveLength(2);
    expect(blocks[0].name).toBe("Block 1");
    expect(blocks[1].name).toBe("Block 2");
  });

  test("should migrate CTA question with external button", () => {
    const questions = [
      {
        id: "cta1",
        type: TSurveyQuestionTypeEnum.CTA,
        headline: { default: "Click me" },
        buttonLabel: { default: "Click" },
        buttonUrl: "https://example.com",
        buttonExternal: true,
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    const ctaElement = blocks[0].elements[0] as TSurveyCTAElement;

    expect(ctaElement.ctaButtonLabel).toEqual({ default: "Click" });
    expect(ctaElement.buttonExternal).toBe(true);
    expect(ctaElement.buttonUrl).toBe("https://example.com");
    expect((ctaElement as unknown as any).buttonLabel).toBeUndefined();
  });

  test("should migrate CTA question without external button", () => {
    const questions = [
      {
        id: "cta1",
        type: TSurveyQuestionTypeEnum.CTA,
        headline: { default: "Continue" },
        buttonLabel: { default: "Next" },
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    const ctaElement = blocks[0].elements[0] as TSurveyCTAElement;

    expect(ctaElement.buttonExternal).toBeUndefined();
    expect(ctaElement.buttonUrl).toBeUndefined();
    expect((ctaElement as unknown as any).buttonLabel).toBeUndefined();
  });

  test("should convert jumpToQuestion actions to jumpToBlock", () => {
    const questions = [
      {
        id: "q1",
        type: "text",
        headline: { default: "Question 1" },
        required: false,
        inputType: "text",
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "and" as const,
              conditions: [
                {
                  id: "c1",
                  leftOperand: { value: "q1", type: "question" },
                  operator: "equals",
                  rightOperand: { type: "static", value: "test" },
                },
              ],
            },
            actions: [
              {
                id: "a1",
                objective: "jumpToQuestion",
                target: "q2",
              },
            ],
          },
        ],
      },
      {
        id: "q2",
        type: "text",
        headline: { default: "Question 2" },
        required: false,
        inputType: "text",
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    const action = blocks[0].logic![0].actions[0];
    expect(action.objective).toBe("jumpToBlock");
    if (action.objective === "jumpToBlock") {
      expect(action.target).toBe(blocks[1].id);
    }
  });

  test("should convert question type to element type in logic conditions", () => {
    const questions = [
      {
        id: "q1",
        type: "text",
        headline: { default: "Question 1" },
        required: false,
        inputType: "text",
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "and" as const,
              conditions: [
                {
                  id: "c1",
                  leftOperand: { value: "q1", type: "question" },
                  operator: "equals",
                  rightOperand: { type: "question", value: "q2" },
                },
              ],
            },
            actions: [],
          },
        ],
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    const condition = blocks[0].logic![0].conditions.conditions[0] as {
      leftOperand: { type: string };
      rightOperand: { type: string };
    };
    expect(condition.leftOperand.type).toBe("element");
    expect(condition.rightOperand.type).toBe("element");
  });

  test("should move question-level buttonLabel and backButtonLabel to block level", () => {
    const questions = [
      {
        id: "q1",
        type: "text",
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        buttonLabel: { default: "Next" },
        backButtonLabel: { default: "Back" },
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    expect(blocks[0].buttonLabel).toEqual({ default: "Next" });
    expect(blocks[0].backButtonLabel).toEqual({ default: "Back" });
    const element = blocks[0].elements[0] as Record<string, unknown>;
    expect(element.buttonLabel).toBeUndefined();
    expect(element.backButtonLabel).toBeUndefined();
  });

  test("should clean CTA logic for CTA without external button", () => {
    const questions = [
      {
        id: "cta1",
        type: "cta",
        headline: { default: "CTA" },
        required: false,
        buttonExternal: false,
      },
      {
        id: "q1",
        type: "text",
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "and" as const,
              conditions: [
                {
                  id: "c1",
                  leftOperand: { value: "cta1", type: "question" },
                  operator: "isClicked",
                },
              ],
            },
            actions: [
              {
                id: "a1",
                objective: "jumpToQuestion",
                target: "q2",
              },
            ],
          },
        ],
      },
      {
        id: "q2",
        type: "text",
        headline: { default: "Question 2" },
        required: false,
        inputType: "text",
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    expect(blocks[1].logic).toBeUndefined();
  });

  test("should preserve isClicked logic for CTA with external button", () => {
    const questions = [
      {
        id: "cta1",
        type: "cta",
        headline: { default: "CTA" },
        required: false,
        buttonLabel: { default: "Click" },
        buttonUrl: "https://example.com",
        buttonExternal: true,
      },
      {
        id: "q1",
        type: "text",
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "and" as const,
              conditions: [
                {
                  id: "c1",
                  leftOperand: { value: "cta1", type: "question" },
                  operator: "isClicked",
                },
              ],
            },
            actions: [
              {
                id: "a1",
                objective: "jumpToQuestion",
                target: "q2",
              },
            ],
          },
        ],
      },
      {
        id: "q2",
        type: "text",
        headline: { default: "Question 2" },
        required: false,
        inputType: "text",
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    expect(blocks[1].logic).toBeDefined();
    expect(blocks[1].logic![0].conditions.conditions[0]).toBeDefined();
  });
});

describe("transformBlocksToQuestions", () => {
  test("should return empty array for empty blocks", () => {
    const questions = transformBlocksToQuestions([], []);
    expect(questions).toEqual([]);
  });

  test("should skip blocks with no elements", () => {
    const blocks = [
      {
        id: "b1",
        name: "Empty Block",
        elements: [],
      },
    ];

    const questions = transformBlocksToQuestions(blocks, []);
    expect(questions).toEqual([]);
  });

  test("should convert a single block to a question", () => {
    const blocks = [
      {
        id: "b1",
        name: "Block 1",
        elements: [
          {
            id: "q1",
            type: "text",
            headline: { default: "What is your name?" },
            required: false,
            inputType: "text",
          },
        ],
      },
    ] as unknown as TSurveyBlock[];

    const questions = transformBlocksToQuestions(blocks, []);

    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe("q1");
    expect(questions[0].type).toBe("text");
  });

  test("should convert CTA element with ctaButtonLabel to question with buttonLabel", () => {
    const blocks = [
      {
        id: "b1",
        name: "Block 1",
        elements: [
          {
            id: "cta1",
            type: "cta",
            headline: { default: "Click me" },
            required: false,
            ctaButtonLabel: { default: "Click" },
            buttonUrl: "https://example.com",
            buttonExternal: true,
          },
        ],
      },
    ] as unknown as TSurveyBlock[];

    const questions = transformBlocksToQuestions(blocks, []);

    const ctaQuestion = questions[0] as Record<string, unknown>;
    expect(ctaQuestion.buttonLabel).toEqual({ default: "Click" });
    expect(ctaQuestion.buttonExternal).toBe(true);
    expect(ctaQuestion.buttonUrl).toBe("https://example.com");
  });

  test("should convert jumpToBlock actions to jumpToQuestion", () => {
    const blocks = [
      {
        id: "b1",
        name: "Block 1",
        elements: [
          {
            id: "q1",
            type: "text",
            headline: { default: "Question 1" },
            required: false,
            inputType: "text",
          },
        ],
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "and" as const,
              conditions: [
                {
                  id: "c1",
                  leftOperand: { value: "q1", type: "element" },
                  operator: "equals",
                  rightOperand: { type: "static", value: "test" },
                },
              ],
            },
            actions: [
              {
                id: "a1",
                objective: "jumpToBlock",
                target: "b2",
              },
            ],
          },
        ],
      },
      {
        id: "b2",
        name: "Block 2",
        elements: [
          {
            id: "q2",
            type: "text",
            headline: { default: "Question 2" },
            required: false,
            inputType: "text",
          },
        ],
      },
    ] as unknown as TSurveyBlock[];

    const questions = transformBlocksToQuestions(blocks, []);

    const action = questions[0].logic![0].actions[0];
    expect(action.objective).toBe("jumpToQuestion");
    if (action.objective === "jumpToQuestion" || action.objective === "requireAnswer") {
      expect(action.target).toBe("q2");
    }
  });

  test("should convert element type to question type in logic conditions", () => {
    const blocks = [
      {
        id: "b1",
        name: "Block 1",
        elements: [
          {
            id: "q1",
            type: "text",
            headline: { default: "Question 1" },
            required: false,
            inputType: "text",
          },
        ],
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "and" as const,
              conditions: [
                {
                  id: "c1",
                  leftOperand: { value: "q1", type: "element" },
                  operator: "equals",
                  rightOperand: { type: "element", value: "q2" },
                },
              ],
            },
            actions: [],
          },
        ],
      },
    ] as unknown as TSurveyBlock[];

    const questions = transformBlocksToQuestions(blocks, []);

    const condition = questions[0].logic![0].conditions.conditions[0] as {
      leftOperand: { type: string };
      rightOperand: { type: string };
    };
    expect(condition.leftOperand.type).toBe("question");
    expect(condition.rightOperand.type).toBe("question");
  });

  test("should move block-level buttonLabel and backButtonLabel to question level", () => {
    const blocks = [
      {
        id: "b1",
        name: "Block 1",
        elements: [
          {
            id: "q1",
            type: "text",
            headline: { default: "Question" },
            required: false,
            inputType: "text",
          },
        ],
        buttonLabel: { default: "Next" },
        backButtonLabel: { default: "Back" },
      },
    ] as unknown as TSurveyBlock[];

    const questions = transformBlocksToQuestions(blocks, []);

    expect(questions[0].buttonLabel).toEqual({ default: "Next" });
    expect(questions[0].backButtonLabel).toEqual({ default: "Back" });
  });

  test("should handle blocks with multiple elements by taking the first element", () => {
    const blocks = [
      {
        id: "b1",
        name: "Block 1",
        elements: [
          {
            id: "q1",
            type: "text",
            headline: { default: "First element" },
            required: false,
            inputType: "text",
          },
          {
            id: "q2",
            type: "text",
            headline: { default: "Second element" },
            required: false,
            inputType: "text",
          },
        ],
      },
    ] as unknown as TSurveyBlock[];

    const questions = transformBlocksToQuestions(blocks, []);

    expect(questions).toHaveLength(1);
    expect(questions[0].id).toBe("q1");
  });
});

describe("CTA Logic Cleaning", () => {
  test("should remove isSkipped logic from CTA with external button", () => {
    const questions = [
      {
        id: "cta1",
        type: "cta",
        headline: { default: "CTA" },
        required: false,
        buttonLabel: { default: "Click" },
        buttonUrl: "https://example.com",
        buttonExternal: true,
      },
      {
        id: "q1",
        type: "text",
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "and" as const,
              conditions: [
                {
                  id: "c1",
                  leftOperand: { value: "cta1", type: "question" },
                  operator: "isSkipped",
                },
              ],
            },
            actions: [
              {
                id: "a1",
                objective: "jumpToQuestion",
                target: "q2",
              },
            ],
          },
        ],
      },
      {
        id: "q2",
        type: "text",
        headline: { default: "Question 2" },
        required: false,
        inputType: "text",
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    // Logic should be removed because isSkipped was the only condition
    expect(blocks[1].logic).toBeUndefined();
  });

  test("should clean nested condition groups with CTA logic", () => {
    const questions = [
      {
        id: "cta1",
        type: "cta",
        headline: { default: "CTA" },
        required: false,
        buttonExternal: false,
      },
      {
        id: "q1",
        type: "text",
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "or" as const,
              conditions: [
                {
                  id: "cg2",
                  connector: "and" as const,
                  conditions: [
                    {
                      id: "c1",
                      leftOperand: { value: "cta1", type: "question" },
                      operator: "isClicked",
                    },
                  ],
                },
                {
                  id: "c2",
                  leftOperand: { value: "q1", type: "question" },
                  operator: "equals",
                  rightOperand: { type: "static", value: "test" },
                },
              ],
            },
            actions: [
              {
                id: "a1",
                objective: "jumpToQuestion",
                target: "q2",
              },
            ],
          },
        ],
      },
      {
        id: "q2",
        type: "text",
        headline: { default: "Question 2" },
        required: false,
        inputType: "text",
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    // Should keep only the non-CTA condition
    expect(blocks[1].logic).toBeDefined();
    expect(blocks[1].logic![0].conditions.conditions).toHaveLength(1);
  });

  test("should preserve non-CTA conditions while removing CTA conditions", () => {
    const questions = [
      {
        id: "cta1",
        type: "cta",
        headline: { default: "CTA" },
        required: false,
        buttonExternal: false,
      },
      {
        id: "q1",
        type: "text",
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "and" as const,
              conditions: [
                {
                  id: "c1",
                  leftOperand: { value: "cta1", type: "question" },
                  operator: "isClicked",
                },
                {
                  id: "c2",
                  leftOperand: { value: "q1", type: "question" },
                  operator: "equals",
                  rightOperand: { type: "static", value: "test" },
                },
              ],
            },
            actions: [
              {
                id: "a1",
                objective: "jumpToQuestion",
                target: "q2",
              },
            ],
          },
        ],
      },
      {
        id: "q2",
        type: "text",
        headline: { default: "Question 2" },
        required: false,
        inputType: "text",
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    // Should keep the non-CTA condition
    expect(blocks[1].logic).toBeDefined();
    expect(blocks[1].logic![0].conditions.conditions).toHaveLength(1);
    const condition = blocks[1].logic![0].conditions.conditions[0] as {
      leftOperand: { value: string };
    };
    expect(condition.leftOperand.value).toBe("q1");
  });

  test("should handle multiple CTA questions in logic", () => {
    const questions = [
      {
        id: "cta1",
        type: "cta",
        headline: { default: "CTA 1" },
        required: false,
        buttonExternal: false,
      },
      {
        id: "cta2",
        type: "cta",
        headline: { default: "CTA 2" },
        required: false,
        buttonLabel: { default: "Click" },
        buttonUrl: "https://example.com",
        buttonExternal: true,
      },
      {
        id: "q1",
        type: "text",
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "or" as const,
              conditions: [
                {
                  id: "c1",
                  leftOperand: { value: "cta1", type: "question" },
                  operator: "isClicked",
                },
                {
                  id: "c2",
                  leftOperand: { value: "cta2", type: "question" },
                  operator: "isClicked",
                },
              ],
            },
            actions: [
              {
                id: "a1",
                objective: "jumpToQuestion",
                target: "q2",
              },
            ],
          },
        ],
      },
      {
        id: "q2",
        type: "text",
        headline: { default: "Question 2" },
        required: false,
        inputType: "text",
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    // Should keep only cta2's isClicked (external button)
    expect(blocks[2].logic).toBeDefined();
    expect(blocks[2].logic![0].conditions.conditions).toHaveLength(1);
  });
});

describe("Logic Fallback Transformation", () => {
  test("should convert logicFallback question ID to block ID", () => {
    const questions = [
      {
        id: "q1",
        type: "text",
        headline: { default: "Question 1" },
        required: false,
        inputType: "text",
        logicFallback: "q2",
      },
      {
        id: "q2",
        type: "text",
        headline: { default: "Question 2" },
        required: false,
        inputType: "text",
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    expect(blocks[0].logicFallback).toBeDefined();
    expect(blocks[0].logicFallback).toBe(blocks[1].id);
  });

  test("should handle logicFallback pointing to ending", () => {
    const endings = [{ id: "end1", type: "endScreen" as const, headline: { default: "Thank you" } }];
    const questions = [
      {
        id: "q1",
        type: "text",
        headline: { default: "Question 1" },
        required: false,
        inputType: "text",
        logicFallback: "end1",
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, endings);

    expect(blocks[0].logicFallback).toBe("end1");
  });

  test("should convert block logicFallback to question ID", () => {
    const blocks = [
      {
        id: "b1",
        name: "Block 1",
        elements: [
          {
            id: "q1",
            type: "text",
            headline: { default: "Question 1" },
            required: false,
            inputType: "text",
          },
        ],
        logicFallback: "b2",
      },
      {
        id: "b2",
        name: "Block 2",
        elements: [
          {
            id: "q2",
            type: "text",
            headline: { default: "Question 2" },
            required: false,
            inputType: "text",
          },
        ],
      },
    ] as unknown as TSurveyBlock[];

    const questions = transformBlocksToQuestions(blocks, []);

    expect(questions[0].logicFallback).toBe("q2");
  });

  test("should handle block logicFallback pointing to ending", () => {
    const endings = [{ id: "end1", type: "endScreen" as const, headline: { default: "Thank you" } }];
    const blocks = [
      {
        id: "b1",
        name: "Block 1",
        elements: [
          {
            id: "q1",
            type: "text",
            headline: { default: "Question 1" },
            required: false,
            inputType: "text",
          },
        ],
        logicFallback: "end1",
      },
    ] as unknown as TSurveyBlock[];

    const questions = transformBlocksToQuestions(blocks, endings);

    expect(questions[0].logicFallback).toBe("end1");
  });
});

describe("Edge Cases", () => {
  test("should handle questions with empty logic array", () => {
    const questions = [
      {
        id: "q1",
        type: "text",
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        logic: [],
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    expect(blocks[0].logic).toEqual([]);
  });

  test("should handle blocks with empty logic array", () => {
    const blocks = [
      {
        id: "b1",
        name: "Block 1",
        elements: [
          {
            id: "q1",
            type: "text",
            headline: { default: "Question" },
            required: false,
            inputType: "text",
          },
        ],
        logic: [],
      },
    ] as unknown as TSurveyBlock[];

    const questions = transformBlocksToQuestions(blocks, []);

    // Empty logic arrays are not copied (become undefined)
    expect(questions[0].logic).toBeUndefined();
  });

  test("should handle CTA without buttonUrl but with buttonExternal=true", () => {
    const questions = [
      {
        id: "cta1",
        type: "cta",
        headline: { default: "CTA" },
        buttonLabel: { default: "Click" },
        buttonExternal: true,
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    const ctaElement = blocks[0].elements[0] as TSurveyCTAElement;
    expect(ctaElement.buttonExternal).toBeUndefined();
    expect(ctaElement.buttonUrl).toBeUndefined();
  });

  test("should handle jump to ending in logic actions", () => {
    const endings = [{ id: "end1", type: "endScreen" as const, headline: { default: "Thank you" } }];
    const questions = [
      {
        id: "q1",
        type: "text",
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "and" as const,
              conditions: [
                {
                  id: "c1",
                  leftOperand: { value: "q1", type: "question" },
                  operator: "equals",
                  rightOperand: { type: "static", value: "yes" },
                },
              ],
            },
            actions: [
              {
                id: "a1",
                objective: "jumpToQuestion",
                target: "end1",
              },
            ],
          },
        ],
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, endings);

    const action = blocks[0].logic![0].actions[0];
    expect(action.objective).toBe("jumpToBlock");
    if (action.objective === "jumpToBlock") {
      expect(action.target).toBe("end1");
    }
  });

  test("should handle jump to ending in reverse transformation", () => {
    const endings = [{ id: "end1", type: "endScreen" as const, headline: { default: "Thank you" } }];
    const blocks = [
      {
        id: "b1",
        name: "Block 1",
        elements: [
          {
            id: "q1",
            type: "text",
            headline: { default: "Question" },
            required: false,
            inputType: "text",
          },
        ],
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "and" as const,
              conditions: [
                {
                  id: "c1",
                  leftOperand: { value: "q1", type: "element" },
                  operator: "equals",
                  rightOperand: { type: "static", value: "yes" },
                },
              ],
            },
            actions: [
              {
                id: "a1",
                objective: "jumpToBlock",
                target: "end1",
              },
            ],
          },
        ],
      },
    ] as unknown as TSurveyBlock[];

    const questions = transformBlocksToQuestions(blocks, endings);

    const action = questions[0].logic![0].actions[0];
    expect(action.objective).toBe("jumpToQuestion");
    if (action.objective === "jumpToQuestion" || action.objective === "requireAnswer") {
      expect(action.target).toBe("end1");
    }
  });

  test("should handle non-jumpToQuestion/jumpToBlock actions", () => {
    const questions = [
      {
        id: "q1",
        type: "text",
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "and" as const,
              conditions: [
                {
                  id: "c1",
                  leftOperand: { value: "q1", type: "question" },
                  operator: "equals",
                  rightOperand: { type: "static", value: "yes" },
                },
              ],
            },
            actions: [
              {
                id: "a1",
                objective: "calculate",
                variableId: "var1",
                value: { type: "static", value: 10 },
              },
            ],
          },
        ],
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    const action = blocks[0].logic![0].actions[0];
    expect(action.objective).toBe("calculate");
  });

  test("should handle blocks with no logic", () => {
    const blocks = [
      {
        id: "b1",
        name: "Block 1",
        elements: [
          {
            id: "q1",
            type: "text",
            headline: { default: "Question" },
            required: false,
            inputType: "text",
          },
        ],
      },
    ] as unknown as TSurveyBlock[];

    const questions = transformBlocksToQuestions(blocks, []);

    expect(questions[0].logic).toBeUndefined();
  });

  test("should handle jump to unknown target in logic actions", () => {
    const questions = [
      {
        id: "q1",
        type: "text",
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "and" as const,
              conditions: [
                {
                  id: "c1",
                  leftOperand: { value: "q1", type: "question" },
                  operator: "equals",
                  rightOperand: { type: "static", value: "yes" },
                },
              ],
            },
            actions: [
              {
                id: "a1",
                objective: "jumpToQuestion",
                target: "unknown-target",
              },
            ],
          },
        ],
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    // Should still convert to jumpToBlock even if target is unknown
    const action = blocks[0].logic![0].actions[0];
    expect(action.objective).toBe("jumpToBlock");
    if (action.objective === "jumpToBlock") {
      expect(action.target).toBe("unknown-target");
    }
  });

  test("should handle unknown logicFallback target", () => {
    const questions = [
      {
        id: "q1",
        type: "text",
        headline: { default: "Question" },
        required: false,
        inputType: "text",
        logicFallback: "unknown-target",
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(questions, []);

    // Should return undefined for unknown target
    expect(blocks[0].logicFallback).toBeUndefined();
  });
});

describe("round-trip transformation", () => {
  test("should maintain question structure through round-trip transformation", () => {
    const originalQuestions = [
      {
        id: "q1",
        type: "text",
        headline: { default: "What is your name?" },
        required: false,
        inputType: "text",
        buttonLabel: { default: "Next" },
      },
      {
        id: "q2",
        type: "multipleChoiceSingle",
        headline: { default: "Choose one" },
        required: false,
        choices: [
          { id: "c1", label: { default: "Option 1" } },
          { id: "c2", label: { default: "Option 2" } },
        ],
        shuffleOption: "none",
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(originalQuestions, []);
    const transformedQuestions = transformBlocksToQuestions(blocks, []);

    expect(transformedQuestions).toHaveLength(2);
    expect(transformedQuestions[0].type).toBe("text");
    expect(transformedQuestions[0].headline).toEqual({ default: "What is your name?" });
    expect(transformedQuestions[0].buttonLabel).toEqual({ default: "Next" });
    expect(transformedQuestions[1].type).toBe("multipleChoiceSingle");
  });

  test("should maintain logic through round-trip transformation", () => {
    const originalQuestions = [
      {
        id: "q1",
        type: "text",
        headline: { default: "Question 1" },
        required: false,
        inputType: "text",
        logic: [
          {
            id: "l1",
            conditions: {
              id: "cg1",
              connector: "and" as const,
              conditions: [
                {
                  id: "c1",
                  leftOperand: { value: "q1", type: "question" },
                  operator: "equals",
                  rightOperand: { type: "static", value: "test" },
                },
              ],
            },
            actions: [
              {
                id: "a1",
                objective: "jumpToQuestion",
                target: "q2",
              },
            ],
          },
        ],
      },
      {
        id: "q2",
        type: "text",
        headline: { default: "Question 2" },
        required: false,
        inputType: "text",
      },
    ] as unknown as TSurveyQuestion[];

    const blocks = transformQuestionsToBlocks(originalQuestions, []);
    const transformedQuestions = transformBlocksToQuestions(blocks, []);

    expect(transformedQuestions[0].logic).toBeDefined();
    const action = transformedQuestions[0].logic![0].actions[0];
    expect(action.objective).toBe("jumpToQuestion");
    if (action.objective === "jumpToQuestion" || action.objective === "requireAnswer") {
      expect(action.target).toBe("q2");
    }
  });
});
