import { afterEach, describe, expect, test, vi } from "vitest";
import {
  type TEnvValidationIssue,
  formatEnvValidationErrorMessage,
  formatEnvValidationIssue,
  throwEnvValidationError,
} from "./env-validation-error";

describe("env validation error", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("formats a top-level env validation issue", () => {
    const issue: TEnvValidationIssue = {
      path: ["ENCRYPTION_KEY"],
      message: "Invalid input: expected string, received undefined",
    };

    expect(formatEnvValidationIssue(issue)).toBe(
      "ENCRYPTION_KEY: Invalid input: expected string, received undefined"
    );
  });

  test("formats multiple env validation issues", () => {
    const issues: TEnvValidationIssue[] = [
      { path: ["ENCRYPTION_KEY"], message: "Invalid input: expected string, received undefined" },
      { path: ["HUB_API_URL"], message: "Invalid URL" },
    ];

    expect(formatEnvValidationErrorMessage(issues)).toBe(
      [
        "Invalid environment variables:",
        "  - ENCRYPTION_KEY: Invalid input: expected string, received undefined",
        "  - HUB_API_URL: Invalid URL",
      ].join("\n")
    );
  });

  test("formats nested issue paths with dot notation", () => {
    const issue: TEnvValidationIssue = {
      path: ["AI", { key: "GOOGLE_CLOUD_CREDENTIALS_JSON" }],
      message: "Invalid JSON object",
    };

    expect(formatEnvValidationIssue(issue)).toBe("AI.GOOGLE_CLOUD_CREDENTIALS_JSON: Invalid JSON object");
  });

  test("uses unknown when an issue has no path", () => {
    expect(formatEnvValidationIssue({ message: "Invalid input" })).toBe("unknown: Invalid input");
    expect(formatEnvValidationIssue({ path: [], message: "Invalid input" })).toBe("unknown: Invalid input");
  });

  test("logs structured issues and throws the formatted validation error", () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const issues: TEnvValidationIssue[] = [{ path: ["ENCRYPTION_KEY"], message: "Missing value" }];

    expect(() => throwEnvValidationError(issues)).toThrow(
      ["Invalid environment variables:", "  - ENCRYPTION_KEY: Missing value"].join("\n")
    );
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      ["Invalid environment variables:", "  - ENCRYPTION_KEY: Missing value"].join("\n"),
      { issues }
    );
  });
});
