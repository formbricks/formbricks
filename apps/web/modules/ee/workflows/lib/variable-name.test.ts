import { describe, expect, test } from "vitest";
import { getVariableDisplayName } from "./variable-name";

describe("getVariableDisplayName", () => {
  test("names Variables the way the picker lists them", () => {
    expect(getVariableDisplayName("payload.customer.id")).toBe("customer.id");
    expect(getVariableDisplayName("steps.ab12cd34.body.json.club")).toBe("body.json.club");
    expect(getVariableDisplayName("steps.ab12cd34.status")).toBe("status");
    expect(getVariableDisplayName("response.q1")).toBe("response.q1");
  });

  test("prefers a known label", () => {
    expect(getVariableDisplayName("response.q1", new Map([["response.q1", "How likely…"]]))).toBe(
      "How likely…"
    );
  });
});
