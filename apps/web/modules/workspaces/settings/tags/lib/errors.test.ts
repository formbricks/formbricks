import { describe, expect, test } from "vitest";
import { V3ApiError } from "@/modules/api/lib/v3-client";
import { isDuplicateTagNameError } from "./errors";

const problem = (invalid_params?: { name: string; reason: string }[]) =>
  new V3ApiError({ status: 422, detail: "Unable to update tag", invalid_params });

describe("isDuplicateTagNameError", () => {
  test("recognises the duplicate-name code the route reports in invalid_params", () => {
    expect(isDuplicateTagNameError(problem([{ name: "name", reason: "tag_name_already_exists" }]))).toBe(
      true
    );
  });

  test("does not treat another field-level reason as a duplicate", () => {
    expect(isDuplicateTagNameError(problem([{ name: "name", reason: "invalid" }]))).toBe(false);
  });

  test("does not treat a 422 with no invalid_params as a duplicate", () => {
    expect(isDuplicateTagNameError(problem())).toBe(false);
  });

  test("ignores errors that are not a V3ApiError at all", () => {
    // The previous version read a `details.code` property, which `V3ApiError` does not have — so the
    // duplicate case fell through to the generic toast. A plain object must not satisfy this check.
    expect(isDuplicateTagNameError({ details: { code: "tag_name_already_exists" } })).toBe(false);
    expect(isDuplicateTagNameError(new Error("boom"))).toBe(false);
    expect(isDuplicateTagNameError(undefined)).toBe(false);
  });
});
