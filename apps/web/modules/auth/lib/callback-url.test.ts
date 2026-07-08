import { describe, expect, test } from "vitest";
import {
  getInviteTokenFromCallbackUrl,
  getRelativeCallbackUrl,
  getSearchParamString,
  resolveAuthCallbackUrl,
} from "./callback-url";

const WEBAPP_URL = "http://localhost:3000";

describe("auth callback URL helpers", () => {
  test("returns a valid callback URL from the search params", () => {
    const result = resolveAuthCallbackUrl({
      searchParamCallbackUrl: "http://localhost:3000/invite?token=search-token",
      webAppUrl: WEBAPP_URL,
    });

    expect(result).toBe("http://localhost:3000/invite?token=search-token");
  });

  test("returns null when no callback URL is provided", () => {
    const result = resolveAuthCallbackUrl({
      searchParamCallbackUrl: undefined,
      webAppUrl: WEBAPP_URL,
    });

    expect(result).toBeNull();
  });

  test("rejects callback URLs on a different origin", () => {
    const result = resolveAuthCallbackUrl({
      searchParamCallbackUrl: "https://evil.example/invite?token=bad",
      webAppUrl: WEBAPP_URL,
    });

    expect(result).toBeNull();
  });

  test("returns a relative callback path for in-app navigation", () => {
    const result = getRelativeCallbackUrl(
      "http://localhost:3000/invite?token=abc123&source=signin",
      WEBAPP_URL
    );

    expect(result).toBe("/invite?token=abc123&source=signin");
  });

  test("extracts invite tokens from validated callback URLs", () => {
    const result = getInviteTokenFromCallbackUrl(
      "http://localhost:3000/invite?token=abc123&source=signin",
      WEBAPP_URL
    );

    expect(result).toBe("abc123");
  });

  test("uses the first value when the callback URL search param is repeated", () => {
    const result = resolveAuthCallbackUrl({
      searchParamCallbackUrl: ["http://localhost:3000/invite?token=first", "http://localhost:3000/second"],
      webAppUrl: WEBAPP_URL,
    });

    expect(result).toBe("http://localhost:3000/invite?token=first");
  });

  test("returns null when the callback URL search param is an empty array", () => {
    const result = resolveAuthCallbackUrl({
      searchParamCallbackUrl: [],
      webAppUrl: WEBAPP_URL,
    });

    expect(result).toBeNull();
  });

  test("falls back to '/' when the relative callback URL is missing or invalid", () => {
    expect(getRelativeCallbackUrl(undefined, WEBAPP_URL)).toBe("/");
    expect(getRelativeCallbackUrl("https://evil.example/x", WEBAPP_URL)).toBe("/");
  });

  test("falls back to '/' for a same-origin URL with a scheme-relative (//) pathname", () => {
    // Guards ENG-1636: without the validator fix this would return "//evil.example/path",
    // which router.push resolves to an external origin.
    expect(getRelativeCallbackUrl("http://localhost:3000//evil.example/path", WEBAPP_URL)).toBe("/");
  });

  test("returns null invite token when the callback URL is invalid or has no token", () => {
    expect(getInviteTokenFromCallbackUrl("https://evil.example/invite?token=bad", WEBAPP_URL)).toBeNull();
    expect(
      getInviteTokenFromCallbackUrl("http://localhost:3000/invite?source=signin", WEBAPP_URL)
    ).toBeNull();
  });

  test("getSearchParamString normalizes strings, arrays, and missing values", () => {
    expect(getSearchParamString("plain")).toBe("plain");
    expect(getSearchParamString(["first", "second"])).toBe("first");
    expect(getSearchParamString(undefined)).toBe("");
  });
});
