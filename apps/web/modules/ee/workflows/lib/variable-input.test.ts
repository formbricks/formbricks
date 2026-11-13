import { describe, expect, test } from "vitest";
import { fromVariableInputDisplay, insertVariableAtCaret, toVariableInputDisplay } from "./variable-input";

describe("Variable input text", () => {
  test("shows stored tokens as {{path}}, with the fallback after a bar", () => {
    expect(toVariableInputDisplay("id=#recall:payload.customer.id/fallback:#")).toBe(
      "id={{payload.customer.id}}"
    );
    expect(toVariableInputDisplay("Bearer #recall:steps.auth.body.token/fallback:none#")).toBe(
      "Bearer {{steps.auth.body.token|none}}"
    );
  });

  test("stores what the field shows as tokens again, exactly", () => {
    const stored = "a #recall:payload.a/fallback:# b #recall:steps.s1.status/fallback:0#";
    expect(fromVariableInputDisplay(toVariableInputDisplay(stored))).toBe(stored);
  });

  test("leaves braces around anything but a Variable path as text", () => {
    expect(fromVariableInputDisplay("{{name}} and {payload.a}")).toBe("{{name}} and {payload.a}");
    expect(fromVariableInputDisplay("{{payload.a}}")).toBe("#recall:payload.a/fallback:#");
  });

  test("replaces the @ just typed with the picked Variable", () => {
    expect(insertVariableAtCaret("id=@", 4, "payload.customer.id")).toEqual({
      display: "id={{payload.customer.id}}",
      caret: 26,
    });
    expect(insertVariableAtCaret("id=", 3, "payload.customer.id")).toBeNull();
  });
});
