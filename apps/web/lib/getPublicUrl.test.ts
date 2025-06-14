import { beforeEach, describe, expect, test, vi } from "vitest";

// Mock constants module
const envMock = {
  env: {
    WEBAPP_URL: "http://localhost:3000",
    PUBLIC_URL: undefined as string | undefined,
  },
};

vi.mock("@/lib/env", () => envMock);

describe("getPublicDomain", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("should return WEBAPP_URL when PUBLIC_URL is not set", async () => {
    const { getPublicDomain } = await import("./getPublicUrl");
    const domain = getPublicDomain();
    expect(domain).toBe("http://localhost:3000");
  });

  test("should return PUBLIC_URL when it is set", async () => {
    envMock.env.PUBLIC_URL = "https://surveys.example.com";
    const { getPublicDomain } = await import("./getPublicUrl");
    const domain = getPublicDomain();
    expect(domain).toBe("https://surveys.example.com");
  });

  test("should handle empty string PUBLIC_URL by returning WEBAPP_URL", async () => {
    envMock.env.PUBLIC_URL = "";
    const { getPublicDomain } = await import("./getPublicUrl");
    const domain = getPublicDomain();
    expect(domain).toBe("http://localhost:3000");
  });

  test("should handle undefined PUBLIC_URL by returning WEBAPP_URL", async () => {
    envMock.env.PUBLIC_URL = undefined;
    const { getPublicDomain } = await import("./getPublicUrl");
    const domain = getPublicDomain();
    expect(domain).toBe("http://localhost:3000");
  });
});
