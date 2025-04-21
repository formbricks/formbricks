import { getSurvey } from "@/modules/survey/lib/survey";
import { getProjectByEnvironmentId } from "@/modules/survey/link/lib/project";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { IS_FORMBRICKS_CLOUD, SURVEY_URL, WEBAPP_URL } from "@formbricks/lib/constants";
import { COLOR_DEFAULTS } from "@formbricks/lib/styling/constants";
import { TSurvey, TSurveyWelcomeCard } from "@formbricks/types/surveys/types";
import {
  getBasicSurveyMetadata,
  getBrandColorForURL,
  getNameForURL,
  getSurveyOpenGraphMetadata,
} from "./metadata-utils";

// Mock dependencies
vi.mock("@/modules/survey/lib/survey", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@/modules/survey/link/lib/project", () => ({
  getProjectByEnvironmentId: vi.fn(),
}));

// Mock constants
vi.mock("@formbricks/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: vi.fn(() => false),
  WEBAPP_URL: "https://test.formbricks.com",
  SURVEY_URL: "https://surveys.test.formbricks.com",
}));

vi.mock("@formbricks/lib/styling/constants", () => ({
  COLOR_DEFAULTS: {
    brandColor: "#00c4b8",
  },
}));

describe("Metadata Utils", () => {
  // Reset all mocks before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNameForURL", () => {
    test("replaces spaces with %20", () => {
      const result = getNameForURL("Hello World");
      expect(result).toBe("Hello%20World");
    });

    test("handles strings with no spaces correctly", () => {
      const result = getNameForURL("HelloWorld");
      expect(result).toBe("HelloWorld");
    });

    test("handles strings with multiple spaces", () => {
      const result = getNameForURL("Hello  World  Test");
      expect(result).toBe("Hello%20%20World%20%20Test");
    });
  });

  describe("getBrandColorForURL", () => {
    test("replaces # with %23", () => {
      const result = getBrandColorForURL("#ff0000");
      expect(result).toBe("%23ff0000");
    });

    test("handles strings with no # correctly", () => {
      const result = getBrandColorForURL("ff0000");
      expect(result).toBe("ff0000");
    });
  });

  describe("getBasicSurveyMetadata", () => {
    const mockSurveyId = "survey-123";
    const mockEnvironmentId = "env-456";

    test("returns default metadata when survey is not found", async () => {
      const result = await getBasicSurveyMetadata(mockSurveyId);

      expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
      expect(result).toEqual({
        title: "Survey",
        description: "Complete this survey",
        survey: null,
      });
    });

    test("uses welcome card headline when available", async () => {
      const mockSurvey = {
        id: mockSurveyId,
        environmentId: mockEnvironmentId,
        name: "Test Survey",
        welcomeCard: {
          enabled: true,
          timeToFinish: false,
          showResponseCount: false,
          headline: {
            default: "Welcome Headline",
          },
          html: {
            default: "Welcome Description",
          },
        } as TSurveyWelcomeCard,
      } as TSurvey;

      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
      vi.mocked(getProjectByEnvironmentId).mockResolvedValue({ name: "Test Project" } as any);

      const result = await getBasicSurveyMetadata(mockSurveyId);

      expect(getSurvey).toHaveBeenCalledWith(mockSurveyId);
      expect(getProjectByEnvironmentId).toHaveBeenCalledWith(mockEnvironmentId);
      expect(result).toEqual({
        title: "Welcome Headline | Formbricks",
        description: "Welcome Description",
        survey: mockSurvey,
      });
    });

    test("falls back to survey name when welcome card is not enabled", async () => {
      const mockSurvey = {
        id: mockSurveyId,
        environmentId: mockEnvironmentId,
        name: "Test Survey",
        welcomeCard: {
          enabled: false,
        } as TSurveyWelcomeCard,
      } as TSurvey;

      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
      vi.mocked(getProjectByEnvironmentId).mockResolvedValue({ name: "Test Project" } as any);

      const result = await getBasicSurveyMetadata(mockSurveyId);

      expect(result).toEqual({
        title: "Test Survey | Formbricks",
        description: "Complete this survey",
        survey: mockSurvey,
      });
    });

    test("adds Formbricks to title when IS_FORMBRICKS_CLOUD is true", async () => {
      // Change the mock for this specific test
      (IS_FORMBRICKS_CLOUD as unknown as ReturnType<typeof vi.fn>).mockReturnValue(true);

      const mockSurvey = {
        id: mockSurveyId,
        environmentId: mockEnvironmentId,
        name: "Test Survey",
        welcomeCard: {
          enabled: false,
        } as TSurveyWelcomeCard,
      } as TSurvey;

      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);

      const result = await getBasicSurveyMetadata(mockSurveyId);

      expect(result.title).toBe("Test Survey | Formbricks");

      // Reset the mock
      (IS_FORMBRICKS_CLOUD as unknown as ReturnType<typeof vi.fn>).mockReturnValue(false);
    });
  });

  describe("getSurveyOpenGraphMetadata", () => {
    test("generates correct OpenGraph metadata", () => {
      const surveyId = "survey-123";
      const surveyName = "Test Survey";
      const brandColor = COLOR_DEFAULTS.brandColor.replace("#", "%23");
      const encodedName = surveyName.replace(/ /g, "%20");

      const result = getSurveyOpenGraphMetadata(surveyId, surveyName);

      expect(result).toEqual({
        metadataBase: new URL(SURVEY_URL),
        openGraph: {
          title: surveyName,
          description: "Thanks a lot for your time 🙏",
          url: `/s/${surveyId}`,
          siteName: "",
          images: [`/api/v1/og?brandColor=${brandColor}&name=${encodedName}`],
          locale: "en_US",
          type: "website",
        },
        twitter: {
          card: "summary_large_image",
          title: surveyName,
          description: "Thanks a lot for your time 🙏",
          images: [`/api/v1/og?brandColor=${brandColor}&name=${encodedName}`],
        },
      });
    });

    test("handles survey names with spaces correctly", () => {
      const surveyId = "survey-123";
      const surveyName = "Test Survey With Spaces";
      const result = getSurveyOpenGraphMetadata(surveyId, surveyName);

      expect(result.openGraph?.images?.[0]).toContain("name=Test%20Survey%20With%20Spaces");
    });
  });
});
