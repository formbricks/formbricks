import { describe, expect, test } from "vitest";
import { getSpicedbObjectType } from "./object-type";

describe("getSpicedbObjectType", () => {
  test.each([
    ["apiKey", "api_key"],
    ["feedbackDirectory", "feedback_directory"],
    ["feedbackDirectoryAssignment", "feedback_directory_assignment"],
    ["user", "user"],
    ["workspace", "workspace"],
  ] as const)("maps %s to %s", (type, expected) => {
    expect(getSpicedbObjectType(type)).toBe(expected);
  });
});
