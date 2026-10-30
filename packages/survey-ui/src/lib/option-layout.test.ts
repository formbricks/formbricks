import { describe, expect, test } from "vitest";
import { getOptionGroupClassName, getOptionLayout } from "./option-layout";

describe("getOptionLayout", () => {
  test("keeps row and falls back to list for the other variants", () => {
    expect(getOptionLayout("row")).toBe("row");
    expect(getOptionLayout("list")).toBe("list");
    expect(getOptionLayout("dropdown")).toBe("list");
  });
});

describe("getOptionGroupClassName", () => {
  test("wraps a row and gives the Other box its own line", () => {
    const classes = getOptionGroupClassName("row").split(" ");
    expect(classes).toEqual(expect.arrayContaining(["flex", "flex-wrap", "[&>div]:basis-full"]));
  });

  test("stacks a list", () => {
    expect(getOptionGroupClassName("list")).not.toContain("flex");
  });
});
