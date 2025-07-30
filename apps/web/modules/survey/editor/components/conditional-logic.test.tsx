import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import {
  TSurvey,
  TSurveyLogic,
  TSurveyQuestion,
  TSurveyQuestionTypeEnum,
} from "@formbricks/types/surveys/types";
import { ConditionalLogic } from "./conditional-logic";

// Mock @formkit/auto-animate - simplify implementation
vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

vi.mock("@/lib/surveyLogic/utils", () => ({
  duplicateLogicItem: (logicItem: TSurveyLogic) => ({
    ...logicItem,
    id: "new-duplicated-id",
  }),
}));

vi.mock("./logic-editor", () => ({
  LogicEditor: () => <div data-testid="logic-editor">LogicEditor</div>,
}));

describe("ConditionalLogic", () => {
  beforeAll(() => {
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  afterEach(() => {
    cleanup();
  });

  test("should add a new logic condition to the question's logic array when the add logic button is clicked", async () => {
    const mockUpdateQuestion = vi.fn();
    const mockQuestion: TSurveyQuestion = {
      id: "testQuestionId",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Test Question" },
      required: false,
      inputType: "text",
      charLimit: {
        enabled: false,
      },
    };
    const mockSurvey = {
      id: "testSurveyId",
      name: "Test Survey",
      type: "link",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "testEnvId",
      status: "inProgress",
      questions: [mockQuestion],
      endings: [],
    } as unknown as TSurvey;

    render(
      <ConditionalLogic
        localSurvey={mockSurvey}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
      />
    );

    const addLogicButton = screen.getByRole("button", { name: "environments.surveys.edit.add_logic" });
    await userEvent.click(addLogicButton);

    expect(mockUpdateQuestion).toHaveBeenCalledTimes(1);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      logic: expect.arrayContaining([
        expect.objectContaining({
          conditions: expect.objectContaining({
            connector: "and",
            conditions: expect.arrayContaining([
              expect.objectContaining({
                leftOperand: expect.objectContaining({
                  value: "testQuestionId",
                  type: "question",
                }),
              }),
            ]),
          }),
          actions: expect.arrayContaining([
            expect.objectContaining({
              objective: "jumpToQuestion",
              target: "",
            }),
          ]),
        }),
      ]),
    });
  });

  test("should duplicate the specified logic condition and insert it into the logic array", async () => {
    const mockUpdateQuestion = vi.fn();
    const initialLogic: TSurveyLogic = {
      id: "initialLogicId",
      conditions: {
        id: "conditionGroupId",
        connector: "and",
        conditions: [
          {
            id: "conditionId",
            leftOperand: { value: "testQuestionId", type: "question" },
            operator: "equals",
            rightOperand: { value: "value2", type: "static" },
          },
          {
            id: "conditionId2",
            leftOperand: { value: "testQuestionId2", type: "question" },
            operator: "equals",
            rightOperand: { value: "value2", type: "static" },
          },
        ],
      },
      actions: [],
    };
    const mockQuestion: TSurveyQuestion = {
      id: "testQuestionId",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Test Question" },
      required: false,
      inputType: "text",
      charLimit: {
        enabled: false,
      },
      logic: [initialLogic],
    };
    const mockSurvey = {
      id: "testSurveyId",
      name: "Test Survey",
      type: "link",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "testEnvId",
      status: "inProgress",
      questions: [mockQuestion],
      endings: [],
    } as unknown as TSurvey;

    render(
      <ConditionalLogic
        localSurvey={mockSurvey}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
      />
    );

    // First click the ellipsis menu button to open the dropdown
    const menuButton = screen.getByLabelText("More options");
    await userEvent.click(menuButton);

    // Now look for the duplicate option in the dropdown menu that appears
    const duplicateButton = await screen.findByText("common.duplicate");
    await userEvent.click(duplicateButton);

    expect(mockUpdateQuestion).toHaveBeenCalledTimes(1);
    expect(mockUpdateQuestion).toHaveBeenCalledWith(0, {
      logic: expect.arrayContaining([
        initialLogic,
        expect.objectContaining({
          id: "new-duplicated-id",
          conditions: initialLogic.conditions,
          actions: initialLogic.actions,
        }),
      ]),
    });
  });

  test("should render the list of logic conditions and their associated actions based on the question's logic data", () => {
    const mockUpdateQuestion = vi.fn();
    const mockLogic: TSurveyLogic[] = [
      {
        id: "logic1",
        conditions: {
          id: "cond1",
          connector: "and",
          conditions: [],
        },
        actions: [],
      },
      {
        id: "logic2",
        conditions: {
          id: "cond2",
          connector: "or",
          conditions: [],
        },
        actions: [],
      },
    ];
    const mockQuestion: TSurveyQuestion = {
      id: "testQuestionId",
      type: TSurveyQuestionTypeEnum.OpenText,
      headline: { default: "Test Question" },
      required: false,
      inputType: "text",
      charLimit: {
        enabled: false,
      },
      logic: mockLogic,
    };
    const mockSurvey = {
      id: "testSurveyId",
      name: "Test Survey",
      type: "link",
      createdAt: new Date(),
      updatedAt: new Date(),
      environmentId: "testEnvId",
      status: "inProgress",
      questions: [mockQuestion],
      endings: [],
    } as unknown as TSurvey;

    render(
      <ConditionalLogic
        localSurvey={mockSurvey}
        question={mockQuestion}
        questionIdx={0}
        updateQuestion={mockUpdateQuestion}
      />
    );

    expect(screen.getAllByTestId("logic-editor").length).toBe(2);
  });
});
