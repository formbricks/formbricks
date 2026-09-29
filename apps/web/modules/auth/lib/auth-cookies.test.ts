import { beforeEach, describe, expect, test, vi } from "vitest";

/**
 * `USE_SECURE_COOKIES` decides whether the session cookie carries `Secure`. Getting it wrong is the
 * ENG-2076 bug class: a deployment on HTTPS that serves the cookie without `Secure` lets a downgrade to
 * plaintext HTTP leak the session. It had no test before ENG-2599 rewrote its chain.
 */
const constantsMock = { AUTH_URL: undefined as string | undefined };
const envMock = { WEBAPP_URL: undefined as string | undefined };

vi.mock("@/lib/constants", () => constantsMock);
vi.mock("@/lib/env", () => ({ env: envMock }));

const load = async () => {
  vi.resetModules();
  return await import("./auth-cookies");
};

describe("USE_SECURE_COOKIES", () => {
  beforeEach(() => {
    constantsMock.AUTH_URL = undefined;
    envMock.WEBAPP_URL = undefined;
  });

  test("is true when the auth URL is https", async () => {
    constantsMock.AUTH_URL = "https://app.example.com";

    expect((await load()).USE_SECURE_COOKIES).toBe(true);
  });

  test("is false on http, so a local dev session can persist", async () => {
    constantsMock.AUTH_URL = "http://localhost:3000";

    expect((await load()).USE_SECURE_COOKIES).toBe(false);
  });

  test("falls back to WEBAPP_URL when no auth URL is configured (ENG-2076)", async () => {
    // The regression itself: a deployment that sets only WEBAPP_URL=https://… — the primary documented
    // variable — must still get `Secure`, not fall through to "" and serve the cookie without it.
    envMock.WEBAPP_URL = "https://app.example.com";

    expect((await load()).USE_SECURE_COOKIES).toBe(true);
  });

  test("prefers the auth URL over WEBAPP_URL", async () => {
    constantsMock.AUTH_URL = "http://auth.internal:3000";
    envMock.WEBAPP_URL = "https://app.example.com";

    expect((await load()).USE_SECURE_COOKIES).toBe(false);
  });

  test("is false when nothing is configured, rather than throwing", async () => {
    expect((await load()).USE_SECURE_COOKIES).toBe(false);
  });
});
