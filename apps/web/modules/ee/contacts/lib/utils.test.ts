import { describe, expect, test } from "vitest";
import { getContactIdentifier } from "./utils";

describe("utils", () => {
  test("getContactIdentifier returns email if present", () => {
    expect(getContactIdentifier({ email: "a@b.com", userId: "u1" })).toBe("a@b.com");
  });
  test("getContactIdentifier returns userId if no email", () => {
    expect(getContactIdentifier({ userId: "u1" })).toBe("u1");
  });
  test("getContactIdentifier returns empty string if neither", () => {
    expect(getContactIdentifier(null)).toBe("");
    expect(getContactIdentifier({})).toBe("");
  });
});
