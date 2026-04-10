import { describe, expect, test } from "vitest";
import {
  getAuthCallbackUrlFromCookies,
  getInviteTokenFromCallbackUrl,
  getRelativeCallbackUrl,
  resolveAuthCallbackUrl,
} from "./callback-url";

const WEBAPP_URL = "http://localhost:3000";

describe("auth callback URL helpers", () => {
  test("prefers a valid callback URL from search params over the cookie", () => {
    const result = resolveAuthCallbackUrl({
      searchParamCallbackUrl: "http://localhost:3000/invite?token=search-token",
      cookieCallbackUrl: "http://localhost:3000/invite?token=cookie-token",
      webAppUrl: WEBAPP_URL,
    });

    expect(result).toBe("http://localhost:3000/invite?token=search-token");
  });

  test("falls back to the callback URL cookie when the query string only contains an auth error", () => {
    const result = resolveAuthCallbackUrl({
      searchParamCallbackUrl: undefined,
      cookieCallbackUrl: "http://localhost:3000/invite?token=cookie-token&source=signin",
      allowCookieFallback: true,
      webAppUrl: WEBAPP_URL,
    });

    expect(result).toBe("http://localhost:3000/invite?token=cookie-token&source=signin");
  });

  test("does not fall back to the callback URL cookie unless explicitly allowed", () => {
    const result = resolveAuthCallbackUrl({
      searchParamCallbackUrl: undefined,
      cookieCallbackUrl: "http://localhost:3000/invite?token=cookie-token&source=signin",
      webAppUrl: WEBAPP_URL,
    });

    expect(result).toBeNull();
  });

  test("rejects callback URLs on a different origin", () => {
    const result = resolveAuthCallbackUrl({
      searchParamCallbackUrl: "https://evil.example/invite?token=bad",
      cookieCallbackUrl: "https://evil.example/fallback",
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

  test("reads the Auth.js callback URL from the secure cookie first", () => {
    const result = getAuthCallbackUrlFromCookies({
      get: (name: string) => {
        if (name === "__Secure-next-auth.callback-url") {
          return { value: "http://localhost:3000/invite?token=secure" };
        }

        return undefined;
      },
    });

    expect(result).toBe("http://localhost:3000/invite?token=secure");
  });
});
