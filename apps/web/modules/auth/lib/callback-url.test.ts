import { describe, expect, test } from "vitest";
import {
  getInviteTokenFromCallbackUrl,
  getRelativeCallbackUrl,
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
});
