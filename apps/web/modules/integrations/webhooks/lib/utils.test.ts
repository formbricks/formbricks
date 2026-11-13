import { describe, expect, test } from "vitest";
import { getEndpointStatusClassName } from "./utils";

describe("getEndpointStatusClassName", () => {
  test.each([
    [true, "border-green-500 bg-green-50"],
    [false, "border-red-200 bg-red-50"],
    [undefined, "border-slate-200 bg-white"],
  ])("styles an endpoint test result of %s", (result, className) => {
    expect(getEndpointStatusClassName(result)).toBe(className);
  });
});
