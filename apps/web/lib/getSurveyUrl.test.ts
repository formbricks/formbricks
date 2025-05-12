import { beforeEach, describe, expect, test, vi } from "vitest";

// Create a mock module for constants with proper types
const constantsMock = {
  SURVEY_URL: undefined as string | undefined,
  WEBAPP_URL: "http://localhost:3000" as string,
};

// Mock the constants module
vi.mock("./constants", () => constantsMock);

describe("getSurveyDomain", () => {
  beforeEach(() => {
    // Reset the mock values before each test
    constantsMock.SURVEY_URL = undefined;
    constantsMock.WEBAPP_URL = "http://localhost:3000";
    vi.resetModules();
  });

  test("should return WEBAPP_URL when SURVEY_URL is not set", async () => {
    const { getSurveyDomain } = await import("./getSurveyUrl");
    const domain = getSurveyDomain();
    expect(domain).toBe("http://localhost:3000");
  });

  test("should return SURVEY_URL when it is set", async () => {
    constantsMock.SURVEY_URL = "https://surveys.example.com";
    const { getSurveyDomain } = await import("./getSurveyUrl");
    const domain = getSurveyDomain();
    expect(domain).toBe("https://surveys.example.com");
  });

  test("should handle empty string SURVEY_URL by returning WEBAPP_URL", async () => {
    constantsMock.SURVEY_URL = "";
    const { getSurveyDomain } = await import("./getSurveyUrl");
    const domain = getSurveyDomain();
    expect(domain).toBe("http://localhost:3000");
  });

  test("should handle undefined SURVEY_URL by returning WEBAPP_URL", async () => {
    constantsMock.SURVEY_URL = undefined;
    const { getSurveyDomain } = await import("./getSurveyUrl");
    const domain = getSurveyDomain();
    expect(domain).toBe("http://localhost:3000");
  });
});
