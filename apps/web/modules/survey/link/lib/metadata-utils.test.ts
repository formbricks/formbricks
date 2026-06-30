import { beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey, TSurveyWelcomeCard } from "@formbricks/types/surveys/types";
import { getPublicDomain } from "@/lib/getPublicUrl";
import { COLOR_DEFAULTS } from "@/lib/styling/constants";
import { getSurvey } from "@/modules/survey/lib/survey";
import { getWorkspaceById } from "@/modules/survey/link/lib/workspace";
import {
  getBasicSurveyMetadata,
  getBrandColorForURL,
  getMetadataBrandColor,
  getNameForURL,
  getSurveyOpenGraphMetadata,
} from "./metadata-utils";

// Mock dependencies
vi.mock("@/modules/survey/lib/survey", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@/modules/survey/link/lib/workspace", () => ({
  getWorkspaceById: vi.fn(),
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

// Mock recall utility
vi.mock("@/lib/utils/recall", () => ({
  recallToHeadline: vi.fn((headline) => headline),
}));

// Mock text content extraction
vi.mock("@formbricks/types/surveys/validation", () => ({
  getTextContent: vi.fn((text) => text),
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
    const mockWorkspaceId = "workspace-456";

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
        workspaceId: mockWorkspaceId,
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
      } as unknown as TSurvey;

      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
      vi.mocked(getWorkspaceById).mockResolvedValue({ name: "Test Workspace" } as any);

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
        workspaceId: mockWorkspaceId,
        name: "Test Survey",
        metadata: {},
        welcomeCard: {
          enabled: false,
        } as TSurveyWelcomeCard,
      } as unknown as TSurvey;

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
      const { getBasicSurveyMetadata: getBasicSurveyMetadataWithCloudMock } =
        await import("./metadata-utils");

      const mockSurvey = {
        id: mockSurveyId,
        workspaceId: mockWorkspaceId,
        name: "Test Survey",
        metadata: {},
        welcomeCard: {
          enabled: false,
        } as TSurveyWelcomeCard,
      } as unknown as TSurvey;

      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);

      const result = await getBasicSurveyMetadataWithCloudMock(mockSurveyId);

      expect(result.title).toBe("Test Survey | Formbricks");

      // Reset the mock
      vi.doMock("@/lib/constants", () => ({
        IS_FORMBRICKS_CLOUD: false,
        WEBAPP_URL: "https://test.formbricks.com",
      }));
    });

    test("handles welcome card headline with HTML content", async () => {
      const { getTextContent } = await import("@formbricks/types/surveys/validation");

      const mockSurvey = {
        id: mockSurveyId,
        workspaceId: mockWorkspaceId,
        name: "Test Survey",
        metadata: {},
        languages: [],
        welcomeCard: {
          enabled: true,
          timeToFinish: false,
          showResponseCount: false,
          headline: {
            default: "<p>Welcome <strong>Headline</strong></p>",
          },
          html: {
            default: "Welcome Description",
          },
        } as TSurveyWelcomeCard,
      } as unknown as TSurvey;

      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
      vi.mocked(getTextContent).mockReturnValue("Welcome Headline");

      const result = await getBasicSurveyMetadata(mockSurveyId);

      expect(getTextContent).toHaveBeenCalled();
      expect(result.title).toBe("Welcome Headline");
    });

    test("uses localized metadata when language matches a language code", async () => {
      const mockSurvey = {
        id: mockSurveyId,
        workspaceId: mockWorkspaceId,
        name: "Test Survey",
        metadata: {
          title: { default: "Default Title", "de-AT": "Österreichischer Titel" },
          description: { default: "Default Description", "de-AT": "Österreichische Beschreibung" },
        },
        languages: [
          { language: { code: "default", alias: null }, default: true, enabled: true },
          { language: { code: "de-AT", alias: "austrian" }, default: false, enabled: true },
        ],
        welcomeCard: { enabled: false } as TSurveyWelcomeCard,
      } as unknown as TSurvey;

      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);

      const result = await getBasicSurveyMetadata(mockSurveyId, "de-AT");

      expect(result.title).toBe("Österreichischer Titel");
      expect(result.description).toBe("Österreichische Beschreibung");
    });

    test("resolves a language alias to the correct localized metadata", async () => {
      const mockSurvey = {
        id: mockSurveyId,
        workspaceId: mockWorkspaceId,
        name: "Test Survey",
        metadata: {
          title: { default: "Default Title", "de-AT": "Österreichischer Titel" },
          description: { default: "Default Description", "de-AT": "Österreichische Beschreibung" },
        },
        languages: [
          { language: { code: "default", alias: null }, default: true, enabled: true },
          { language: { code: "de-AT", alias: "austrian" }, default: false, enabled: true },
        ],
        welcomeCard: { enabled: false } as TSurveyWelcomeCard,
      } as unknown as TSurvey;

      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);

      const result = await getBasicSurveyMetadata(mockSurveyId, "austrian");

      expect(result.title).toBe("Österreichischer Titel");
      expect(result.description).toBe("Österreichische Beschreibung");
    });

    test("falls back to default metadata when language is not enabled", async () => {
      const mockSurvey = {
        id: mockSurveyId,
        workspaceId: mockWorkspaceId,
        name: "Test Survey",
        metadata: {
          title: { default: "Default Title", "de-AT": "Österreichischer Titel" },
        },
        languages: [
          { language: { code: "default", alias: null }, default: true, enabled: true },
          { language: { code: "de-AT", alias: "austrian" }, default: false, enabled: false },
        ],
        welcomeCard: { enabled: false } as TSurveyWelcomeCard,
      } as unknown as TSurvey;

      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);

      const result = await getBasicSurveyMetadata(mockSurveyId, "austrian");

      expect(result.title).toBe("Default Title");
    });

    test("handles welcome card headline with recall variables", async () => {
      const { recallToHeadline } = await import("@/lib/utils/recall");

      const mockSurvey = {
        id: mockSurveyId,
        workspaceId: mockWorkspaceId,
        name: "Test Survey",
        metadata: {},
        languages: [],
        welcomeCard: {
          enabled: true,
          timeToFinish: false,
          showResponseCount: false,
          headline: {
            default: "Welcome #recall:name/fallback:User#",
          },
          html: {
            default: "Welcome Description",
          },
        } as TSurveyWelcomeCard,
      } as unknown as TSurvey;

      vi.mocked(getSurvey).mockResolvedValue(mockSurvey);
      vi.mocked(recallToHeadline).mockReturnValue({
        default: "Welcome @User",
      });

      const result = await getBasicSurveyMetadata(mockSurveyId);

      expect(recallToHeadline).toHaveBeenCalledWith(
        mockSurvey.welcomeCard.headline,
        mockSurvey,
        false,
        "default"
      );
      expect(result.title).toBe("Welcome @User");
    });
  });

  describe("getMetadataBrandColor", () => {
    test("returns survey brand color when workspace allows override and survey overrides theme", () => {
      const workspaceStyling = { allowStyleOverwrite: true, brandColor: { light: "#ff0000" } };
      const surveyStyling = { overwriteThemeStyling: true, brandColor: { light: "#0000ff" } };

      expect(getMetadataBrandColor(workspaceStyling, surveyStyling as any)).toBe("#0000ff");
    });

    test("returns workspace brand color when survey does not override theme", () => {
      const workspaceStyling = { allowStyleOverwrite: true, brandColor: { light: "#ff0000" } };
      const surveyStyling = { overwriteThemeStyling: false, brandColor: { light: "#0000ff" } };

      expect(getMetadataBrandColor(workspaceStyling, surveyStyling as any)).toBe("#ff0000");
    });

    test("returns workspace brand color when workspace disallows style overwrite", () => {
      const workspaceStyling = { allowStyleOverwrite: false, brandColor: { light: "#ff0000" } };
      const surveyStyling = { overwriteThemeStyling: true, brandColor: { light: "#0000ff" } };

      expect(getMetadataBrandColor(workspaceStyling, surveyStyling as any)).toBe("#ff0000");
    });

    test("returns workspace brand color when survey styling is null", () => {
      const workspaceStyling = { allowStyleOverwrite: true, brandColor: { light: "#ff0000" } };

      expect(getMetadataBrandColor(workspaceStyling, null)).toBe("#ff0000");
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

      expect((result.openGraph?.images as string[])?.[0]).toContain("name=Test%20Survey%20With%20Spaces");
    });
  });
});
