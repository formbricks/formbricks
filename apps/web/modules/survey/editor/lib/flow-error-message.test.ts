import { describe, expect, test } from "vitest";
import { toFlowTabMessage } from "./flow-error-message";

describe("a logic error's toast names the Flow tab", () => {
  test("the schema's Conditional Logic prefix becomes the tab's name", () => {
    expect(
      toFlowTabMessage('Conditional Logic: right operand is required for operator "equals"', "Flow")
    ).toBe('Flow: right operand is required for operator "equals"');
  });

  test("any other message is left as it is", () => {
    expect(toFlowTabMessage("Block name is required", "Flow")).toBe("Block name is required");
    expect(toFlowTabMessage("See Conditional Logic: later", "Flow")).toBe("See Conditional Logic: later");
  });
});
