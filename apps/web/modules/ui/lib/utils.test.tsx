import { describe, expect, test } from "vitest";
import { cn } from "./utils";

describe("cn (class names utility)", () => {
  test("should merge class names correctly", () => {
    expect(cn("class1", "class2")).toBe("class1 class2");
  });

  test("should handle conditional classes", () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn("base", isActive && "active", isDisabled && "disabled")).toBe("base active");
  });

  test("should handle array of classes", () => {
    expect(cn(["class1", "class2"], "class3")).toBe("class1 class2 class3");
  });

  test("should handle objects of classes", () => {
    expect(cn({ active: true, disabled: false })).toBe("active");
  });

  test("should merge Tailwind classes intelligently", () => {
    expect(cn("px-2 py-1", "p-4")).toBe("p-4");
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
  });

  test("should handle undefined and null values", () => {
    expect(cn("base", undefined, null, "active")).toBe("base active");
  });

  test("should handle complex combinations", () => {
    const isError = true;
    const isLarge = true;
    expect(
      cn(
        "base-class",
        {
          "text-red-500": isError,
          "text-green-500": !isError,
          "text-lg": isLarge,
        },
        ["p-2", "m-1"],
        isError && "border-red-500"
      )
    ).toBe("base-class text-red-500 text-lg p-2 m-1 border-red-500");
  });

  test("should handle Tailwind responsive classes", () => {
    const result = cn("sm:p-2 md:p-4", "p-6");
    expect(result).toContain("p-6");
    expect(result).toContain("sm:p-2");
    expect(result).toContain("md:p-4");
  });

  test("should handle Tailwind state classes", () => {
    expect(cn("hover:bg-blue-500", "hover:bg-red-500")).toBe("hover:bg-red-500");
  });

  test("should handle important classes", () => {
    const result = cn("!p-4", "p-2");
    expect(result).toContain("!p-4");
  });
});
