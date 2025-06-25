import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  TConditionGroup,
  TSurvey,
  TSurveyLogic,
  TSurveyLogicAction,
  TSurveyQuestion,
} from "@formbricks/types/surveys/types";
import { LogicEditorConditions } from "./logic-editor-conditions";

vi.mock("../lib/utils", () => ({
  getDefaultOperatorForQuestion: vi.fn(() => "equals" as any),
  getConditionValueOptions: vi.fn(() => []),
  getConditionOperatorOptions: vi.fn(() => []),
  getMatchValueProps: vi.fn(() => ({ show: false, options: [] })),
}));

vi.mock("@formkit/auto-animate/react", () => ({
  useAutoAnimate: () => [null],
}));

describe("LogicEditorConditions", () => {
  afterEach(() => {
    cleanup();
  });

  test("should add a new condition below the specified condition when handleAddConditionBelow is called", async () => {
    const updateQuestion = vi.fn();
    const localSurvey = {
      questions: [{ id: "q1", type: "text", headline: { default: "Question 1" } }],
    } as unknown as TSurvey;
    const question = {
      id: "q1",
      type: "text",
      headline: { default: "Question 1" },
    } as unknown as TSurveyQuestion;
    const logicIdx = 0;
    const questionIdx = 0;

    const initialConditions: TConditionGroup = {
      id: "group1",
      connector: "and",
      conditions: [
        {
          id: "condition1",
          leftOperand: { value: "q1", type: "question" },
          operator: "equals",
          rightOperand: { value: "value1", type: "static" },
        },
      ],
    };

    const logicItem: TSurveyLogic = {
      id: "logic1",
      actions: [{ objective: "jumpToQuestion" } as TSurveyLogicAction],
      conditions: initialConditions,
    };

    const questionWithLogic = {
      ...question,
      logic: [logicItem],
    };

    const { container } = render(
      <LogicEditorConditions
        conditions={initialConditions}
        updateQuestion={updateQuestion}
        question={questionWithLogic}
        localSurvey={localSurvey}
        questionIdx={questionIdx}
        logicIdx={logicIdx}
      />
    );

    // Find the dropdown menu trigger for the condition
    const dropdownTrigger = container.querySelector<HTMLButtonElement>("#condition-0-0-dropdown");
    if (!dropdownTrigger) {
      throw new Error("Dropdown trigger not found");
    }

    // Open the dropdown menu
    await userEvent.click(dropdownTrigger);

    // Simulate clicking the "add condition below" button for condition1
    const addButton = screen.getByText("environments.surveys.edit.add_condition_below");
    await userEvent.click(addButton);

    // Assert that updateQuestion is called with the correct arguments
    expect(updateQuestion).toHaveBeenCalledTimes(1);
    expect(updateQuestion).toHaveBeenCalledWith(questionIdx, {
      logic: expect.arrayContaining([
        expect.objectContaining({
          conditions: expect.objectContaining({
            conditions: expect.arrayContaining([
              expect.objectContaining({ id: "condition1" }),
              expect.objectContaining({
                leftOperand: expect.objectContaining({ value: "q1", type: "question" }),
                operator: "equals",
              }),
            ]),
          }),
        }),
      ]),
    });
  });
});
