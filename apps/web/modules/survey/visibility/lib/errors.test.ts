import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { classifyVisibilityError } from "./errors";

const apiError = (status: number, code?: string) => new V3ApiError({ status, detail: "Nope", code });

describe("classifyVisibilityError", () => {
  test.each([
    [apiError(409, "visibility_blocked_by_connections"), "blocked"],
    [apiError(503, "projection_pending"), "pending"],
    [apiError(403, "visibility_not_enabled"), "not_enabled"],
    [apiError(422, "visibility_change_not_allowed"), "not_allowed"],
  ])("maps the contract's problem codes (%#)", (error, expected) => {
    expect(classifyVisibilityError(error)).toBe(expected);
  });

  test("the shared 403 is not mistaken for the feature being off", () => {
    expect(classifyVisibilityError(apiError(403, "forbidden"))).toBe("other");
    expect(classifyVisibilityError(apiError(403))).toBe("other");
  });

  test("an unknown code wins over its status", () => {
    expect(classifyVisibilityError(apiError(409, "conflict"))).toBe("other");
  });

  test.each([
    [409, "blocked"],
    [422, "not_allowed"],
    [503, "pending"],
    [500, "other"],
  ])("falls back to the status %s when there is no code", (status, expected) => {
    expect(classifyVisibilityError(apiError(status))).toBe(expected);
  });

  test("anything that is not a V3ApiError is other", () => {
    expect(classifyVisibilityError(new Error("offline"))).toBe("other");
    expect(classifyVisibilityError(undefined)).toBe("other");
  });
});
