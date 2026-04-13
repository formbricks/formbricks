import { describe, expect, test } from "vitest";
import { isRouteRateLimitedByEnvoy } from "./envoy-rate-limit-coverage";

describe("isRouteRateLimitedByEnvoy", () => {
  test("matches covered auth callback routes", () => {
    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/auth/callback/credentials",
        method: "POST",
        authType: "none",
      })
    ).toBe(true);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/auth/callback/token",
        method: "POST",
        authType: "none",
      })
    ).toBe(true);
  });

  test("matches covered api-key management and webhook routes", () => {
    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v1/management/surveys",
        method: "GET",
        authType: "apiKey",
      })
    ).toBe(true);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v1/management/storage",
        method: "POST",
        authType: "apiKey",
      })
    ).toBe(true);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v1/webhooks/webhook-id",
        method: "DELETE",
        authType: "apiKey",
      })
    ).toBe(true);
  });

  test("matches covered client routes", () => {
    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v1/client/env_123/environment",
        method: "GET",
        authType: "none",
      })
    ).toBe(true);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v1/client/env_123/responses/response_123",
        method: "PUT",
        authType: "none",
      })
    ).toBe(true);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v1/client/env_123/storage",
        method: "POST",
        authType: "none",
      })
    ).toBe(true);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v2/client/env_123/responses/response_123",
        method: "PUT",
        authType: "none",
      })
    ).toBe(true);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v2/client/env_123/displays",
        method: "POST",
        authType: "none",
      })
    ).toBe(true);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v2/client/env_123/storage",
        method: "POST",
        authType: "none",
      })
    ).toBe(true);
  });

  test("matches covered api-key storage delete route", () => {
    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/storage/env_123/private/file.pdf",
        method: "DELETE",
        authType: "apiKey",
      })
    ).toBe(true);
  });

  test("does not match excluded or uncovered routes", () => {
    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v1/client/og",
        method: "GET",
        authType: "none",
      })
    ).toBe(false);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v2/health",
        method: "GET",
        authType: "none",
      })
    ).toBe(false);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v2/client/env_123/environment",
        method: "GET",
        authType: "none",
      })
    ).toBe(false);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v2/client/env_123/user",
        method: "POST",
        authType: "none",
      })
    ).toBe(false);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v1/management/me",
        method: "GET",
        authType: "session",
      })
    ).toBe(false);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v1/management/storage",
        method: "POST",
        authType: "session",
      })
    ).toBe(false);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/storage/env_123/private/file.pdf",
        method: "DELETE",
        authType: "session",
      })
    ).toBe(false);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v1/webhooks",
        method: "GET",
        authType: "apiKey",
      })
    ).toBe(false);

    expect(
      isRouteRateLimitedByEnvoy({
        pathname: "/api/v1/client/env_123/environment",
        method: "OPTIONS",
        authType: "none",
      })
    ).toBe(false);
  });
});
