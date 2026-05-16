import { beforeEach, describe, expect, test, vi } from "vitest";

const envMock = {
  WEBAPP_URL: undefined as string | undefined,
  PUBLIC_URL: undefined as string | undefined,
};

vi.mock("./env", () => ({
  env: envMock,
}));

const loadGetPublicDomain = async () => {
  vi.resetModules();
  const { getPublicDomain } = await import("./getPublicUrl");
  return getPublicDomain;
};

describe("getPublicDomain", () => {
  beforeEach(() => {
    envMock.WEBAPP_URL = undefined;
    envMock.PUBLIC_URL = undefined;
  });

  test("returns trimmed WEBAPP_URL when configured", async () => {
    envMock.WEBAPP_URL = " https://app.formbricks.com ";

    const getPublicDomain = await loadGetPublicDomain();

    expect(getPublicDomain()).toBe("https://app.formbricks.com");
  });

  test("falls back to localhost when WEBAPP_URL is not set", async () => {
    const getPublicDomain = await loadGetPublicDomain();

    expect(getPublicDomain()).toBe("http://localhost:3000");
  });

  test("returns PUBLIC_URL when set", async () => {
    envMock.WEBAPP_URL = "https://app.formbricks.com";
    envMock.PUBLIC_URL = "https://surveys.formbricks.com";

    const getPublicDomain = await loadGetPublicDomain();

    expect(getPublicDomain()).toBe("https://surveys.formbricks.com");
  });

  test("falls back to WEBAPP_URL when PUBLIC_URL is empty", async () => {
    envMock.WEBAPP_URL = "https://app.formbricks.com";
    envMock.PUBLIC_URL = " ";

    const getPublicDomain = await loadGetPublicDomain();

    expect(getPublicDomain()).toBe("https://app.formbricks.com");
  });
});
