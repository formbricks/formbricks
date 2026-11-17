import { describe, expect, test } from "vitest";
import { getEndpointAccessibleClassName } from "./utils";

describe("getEndpointAccessibleClassName", () => {
  test("marks a reachable endpoint green, an unreachable one red, and an unchecked one neutral", () => {
    expect(getEndpointAccessibleClassName(true)).toBe("border-green-500 bg-green-50");
    expect(getEndpointAccessibleClassName(false)).toBe("border-red-200 bg-red-50");
    expect(getEndpointAccessibleClassName(undefined)).toBe("border-slate-200 bg-white");
  });
});
