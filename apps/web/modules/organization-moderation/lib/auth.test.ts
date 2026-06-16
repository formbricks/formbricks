import { beforeEach, describe, expect, test, vi } from "vitest";
import { isModerationRequestAuthorized } from "./auth";

const { mockConstants } = vi.hoisted(() => ({
  mockConstants: { ORGANIZATION_MODERATION_SECRET: undefined as string | undefined },
}));

vi.mock("@/lib/constants", () => ({
  get ORGANIZATION_MODERATION_SECRET() {
    return mockConstants.ORGANIZATION_MODERATION_SECRET;
  },
}));

const SECRET = "a".repeat(40);

const headersWith = (authorization?: string): Headers => {
  const headers = new Headers();
  if (authorization !== undefined) {
    headers.set("authorization", authorization);
  }
  return headers;
};

describe("isModerationRequestAuthorized", () => {
  beforeEach(() => {
    mockConstants.ORGANIZATION_MODERATION_SECRET = SECRET;
  });

  test("denies when the secret is not configured", () => {
    mockConstants.ORGANIZATION_MODERATION_SECRET = undefined;
    expect(isModerationRequestAuthorized(headersWith(`Bearer ${SECRET}`))).toBe(false);
  });

  test("denies when no authorization header is present", () => {
    expect(isModerationRequestAuthorized(headersWith())).toBe(false);
  });

  test("denies when the scheme is not Bearer", () => {
    expect(isModerationRequestAuthorized(headersWith(SECRET))).toBe(false);
    expect(isModerationRequestAuthorized(headersWith(`Basic ${SECRET}`))).toBe(false);
  });

  test("denies when the token does not match", () => {
    expect(isModerationRequestAuthorized(headersWith(`Bearer ${"b".repeat(40)}`))).toBe(false);
  });

  test("denies when the token length differs", () => {
    expect(isModerationRequestAuthorized(headersWith(`Bearer ${SECRET}extra`))).toBe(false);
  });

  test("allows a matching bearer token (case-insensitive scheme)", () => {
    expect(isModerationRequestAuthorized(headersWith(`Bearer ${SECRET}`))).toBe(true);
    expect(isModerationRequestAuthorized(headersWith(`bearer ${SECRET}`))).toBe(true);
  });
});
