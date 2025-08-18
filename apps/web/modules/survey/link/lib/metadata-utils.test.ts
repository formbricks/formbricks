import { getPublicDomain } from "@/lib/getPublicUrl";
import { COLOR_DEFAULTS } from "@/lib/styling/constants";
import { getSurvey } from "@/modules/survey/lib/survey";
import { getProjectByEnvironmentId } from "@/modules/survey/link/lib/project";
import { beforeEach, describe, expect, test, vi } from "vitest";
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
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  WEBAPP_URL: "https://test.formbricks.com",
}));

vi.mock("@/lib/styling/constants", () => ({
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
        description: "Please complete this survey.",
        survey: null,
        ogImage: undefined,
      });
    });

    test("uses welcome card headline when available", async () => {
      const mockSurvey = {
        id: mockSurveyId,
        environmentId: mockEnvironmentId,
        name: "Test Survey",
        metadata: {},
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
      expect(result).toEqual({
        title: "Welcome Headline",
        description: "Please complete this survey.",
        survey: mockSurvey,
        ogImage: undefined,
      });
    });

    test("falls back to survey name when welcome card is not enabled", async () => {
      const mockSurvey = {
        id: mockSurveyId,
        environmentId: mockEnvironmentId,
        name: "Test Survey",
        metadata: {},
        welcomeCard: {
          enabled: false,
        } as TSurveyWelcomeCard,
      } as TSurvey;

      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);

      const result = await getBasicSurveyMetadata(mockSurveyId);

      expect(result).toEqual({
        title: "Test Survey",
        description: "Please complete this survey.",
        survey: mockSurvey,
        ogImage: undefined,
      });
    });

    test("adds Formbricks to title when IS_FORMBRICKS_CLOUD is true", async () => {
      // Temporarily modify the mocked module
      vi.doMock("@/lib/constants", () => ({
        IS_FORMBRICKS_CLOUD: true,
        WEBAPP_URL: "https://test.formbricks.com",
      }));

      // Re-import the function to use the updated mock
      const { getBasicSurveyMetadata: getBasicSurveyMetadataWithCloudMock } = await import(
        "./metadata-utils"
      );

      const mockSurvey = {
        id: mockSurveyId,
        environmentId: mockEnvironmentId,
        name: "Test Survey",
        metadata: {},
        welcomeCard: {
          enabled: false,
        } as TSurveyWelcomeCard,
      } as TSurvey;

      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);

      const result = await getBasicSurveyMetadataWithCloudMock(mockSurveyId);

      expect(result.title).toBe("Test Survey | Formbricks");

      // Reset the mock
      vi.doMock("@/lib/constants", () => ({
        IS_FORMBRICKS_CLOUD: false,
        WEBAPP_URL: "https://test.formbricks.com",
      }));
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
        metadataBase: new URL(getPublicDomain() as any),
        openGraph: {
          title: surveyName,
          description: "Thanks a lot for your time 🙏",
          url: `/s/${surveyId}`,
          siteName: "",
          images: [`/api/v1/client/og?brandColor=${brandColor}&name=${encodedName}`],
          locale: "en_US",
          type: "website",
        },
        twitter: {
          card: "summary_large_image",
          title: surveyName,
          description: "Thanks a lot for your time 🙏",
          images: [`/api/v1/client/og?brandColor=${brandColor}&name=${encodedName}`],
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
