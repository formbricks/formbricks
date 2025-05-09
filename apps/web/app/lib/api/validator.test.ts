import { describe, expect, test } from "vitest";
import { ZodError, ZodIssueCode } from "zod";
import { transformErrorToDetails } from "./validator";

describe("transformErrorToDetails", () => {
  test("should transform ZodError with a single issue to details object", () => {
    const error = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        expected: "string",
        received: "number",
        path: ["name"],
        message: "Expected string, received number",
      },
    ]);
    const details = transformErrorToDetails(error);
    expect(details).toEqual({
      name: "Expected string, received number",
    });
  });

  test("should transform ZodError with multiple issues to details object", () => {
    const error = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        expected: "string",
        received: "number",
        path: ["name"],
        message: "Expected string, received number",
      },
      {
        code: ZodIssueCode.too_small,
        minimum: 5,
        type: "string",
        inclusive: true,
        exact: false,
        message: "String must contain at least 5 character(s)",
        path: ["address", "street"],
      },
    ]);
    const details = transformErrorToDetails(error);
    expect(details).toEqual({
      name: "Expected string, received number",
      "address.street": "String must contain at least 5 character(s)",
    });
  });

  test("should return an empty object if ZodError has no issues", () => {
    const error = new ZodError([]);
    const details = transformErrorToDetails(error);
    expect(details).toEqual({});
  });

  test("should handle issues with empty paths", () => {
    const error = new ZodError([
      {
        code: ZodIssueCode.custom,
        path: [],
        message: "Global error",
      },
    ]);
    const details = transformErrorToDetails(error);
    expect(details).toEqual({
      "": "Global error",
    });
  });

  test("should handle issues with multi-level paths", () => {
    const error = new ZodError([
      {
        code: ZodIssueCode.invalid_type,
        expected: "string",
        received: "undefined",
        path: ["user", "profile", "firstName"],
        message: "Required",
      },
    ]);
    const details = transformErrorToDetails(error);
    expect(details).toEqual({
      "user.profile.firstName": "Required",
    });
  });
});
