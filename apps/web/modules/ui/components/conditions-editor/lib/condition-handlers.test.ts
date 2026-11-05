import { describe, expect, test, vi } from "vitest";
import type { TGenericCondition } from "@/modules/ui/components/conditions-editor/types";
import { createConditionHandlers, isMultiSelectOperator } from "./condition-handlers";

/**
 * The handlers both layouts of the conditions editor share (default: quotas, chart filters, the
 * Advanced filter, show conditions; sentence: survey logic and show-if).
 */

const condition: TGenericCondition = {
  id: "c1",
  leftOperand: { value: "q1", type: "element" },
  operator: "isSubmitted",
  rightOperand: { value: "a", type: "static" },
};

/** A config whose question fields offer the default, and whose `hf_*` hidden fields don't. */
const setup = () => {
  const onUpdateCondition = vi.fn();
  const handlers = createConditionHandlers(
    {
      getDefaultOperator: () => "isSubmitted",
      getOperatorOptions: (next) =>
        next.leftOperand.value.startsWith("hf_")
          ? [
              { label: "equals", value: "equals" },
              { label: "is set", value: "isSet" },
            ]
          : [
              { label: "is submitted", value: "isSubmitted" },
              { label: "equals", value: "equals" },
            ],
    },
    { onUpdateCondition }
  );
  return { handlers, onUpdateCondition };
};

describe("handleLeftOperandChange: a newly picked field", () => {
  test("starts on the editor's default operator when the field offers it, with no value", () => {
    const { handlers, onUpdateCondition } = setup();
    handlers.handleLeftOperandChange(condition, "q2", {
      label: "Q2",
      value: "q2",
      meta: { type: "element" },
    });

    expect(onUpdateCondition).toHaveBeenCalledWith("c1", {
      leftOperand: { value: "q2", type: "element", meta: { type: "element" } },
      operator: "isSubmitted",
      rightOperand: undefined,
    });
  });

  test("starts on the field's first operator when it doesn't offer the default", () => {
    const { handlers, onUpdateCondition } = setup();
    handlers.handleLeftOperandChange(condition, "hf_source", {
      label: "source",
      value: "hf_source",
      meta: { type: "hiddenField" },
    });

    expect(onUpdateCondition).toHaveBeenCalledWith(
      "c1",
      expect.objectContaining({ operator: "equals", rightOperand: undefined })
    );
  });

  test("an option without a type reads as a static operand", () => {
    const { handlers, onUpdateCondition } = setup();
    handlers.handleLeftOperandChange(condition, "q3");

    expect(onUpdateCondition.mock.calls[0][1].leftOperand).toEqual({
      value: "q3",
      type: "static",
      meta: undefined,
    });
  });
});

describe("handleOperatorChange and handleRightOperandChange", () => {
  test("a new operator clears the value; the current one changes nothing", () => {
    const { handlers, onUpdateCondition } = setup();
    handlers.handleOperatorChange(condition, "isSubmitted");
    expect(onUpdateCondition).not.toHaveBeenCalled();

    handlers.handleOperatorChange(condition, "equals");
    expect(onUpdateCondition).toHaveBeenCalledWith("c1", { operator: "equals", rightOperand: undefined });
  });

  test("a value is stored with its option's type", () => {
    const { handlers, onUpdateCondition } = setup();
    handlers.handleRightOperandChange(condition, ["a", "b"], {
      label: "Var",
      value: "v1",
      meta: { type: "variable" },
    });
    expect(onUpdateCondition).toHaveBeenCalledWith("c1", {
      rightOperand: { value: ["a", "b"], type: "variable" },
    });
  });
});

test("isMultiSelectOperator: list operators allow several values", () => {
  expect(isMultiSelectOperator("includesOneOf")).toBe(true);
  expect(isMultiSelectOperator("equals")).toBe(false);
});
