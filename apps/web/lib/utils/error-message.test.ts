import { describe, expect, test } from "vitest";
import { getFormattedErrorMessage } from "./error-message";

describe("getFormattedErrorMessage", () => {
  test("returns server error when present", () => {
    const result = {
      serverError: "Internal server error occurred",
      validationErrors: {},
    };
    expect(getFormattedErrorMessage(result)).toBe("Internal server error occurred");
  });

  test("formats validation errors correctly with _errors", () => {
    const result = {
      validationErrors: {
        _errors: ["Invalid input", "Missing required field"],
      },
    };
    expect(getFormattedErrorMessage(result)).toBe("Invalid input, Missing required field");
  });

  test("formats validation errors for specific fields", () => {
    const result = {
      validationErrors: {
        name: { _errors: ["Name is required"] },
        email: { _errors: ["Email is invalid"] },
        password: { _errors: ["is too short"] },
      },
    };
    expect(getFormattedErrorMessage(result)).toBe(
      "Name is required\nEmail is invalid\npassword: is too short"
    );
  });

  test("returns empty string for undefined errors", () => {
    const result = { validationErrors: undefined };
    expect(getFormattedErrorMessage(result)).toBe("");
  });
});
