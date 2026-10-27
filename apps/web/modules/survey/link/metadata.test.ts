import { notFound } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import { getBasicSurveyMetadata, getSurveyOpenGraphMetadata } from "./lib/metadata-utils";
import {
  getGenericContactSurveyMetadata,
  getMetadataForContactSurvey,
  getMetadataForLinkSurvey,
} from "./metadata";

vi.mock("@/modules/survey/link/lib/data", () => ({
  getSurveyWithMetadata: vi.fn(),
}));

vi.mock("@/modules/survey/link/lib/workspace", () => ({
  getWorkspaceContextForLinkSurvey: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("./lib/metadata-utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./lib/metadata-utils")>();
  return {
    ...actual,
    getSurveyOpenGraphMetadata: vi.fn(),
    getBasicSurveyMetadata: vi.fn(),
  };
});

// One shared setup for the /s and /c metadata builders, which share the survey-metadata helper.
describe("link-survey metadata", () => {
  const mockSurveyId = "survey-123";
  const mockSurveyName = "Test Survey";
  // Distinct from the page title so the tests can tell which one reaches the social previews.
  const mockOgTitle = "Test Survey | Formbricks";
  const mockDescription = "Please complete this survey.";
  const mockOgImageUrl = "https://example.com/custom-image.png";

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(getBasicSurveyMetadata).mockResolvedValue({
      title: mockSurveyName,
      ogTitle: mockOgTitle,
      description: mockDescription,
      survey: null,
      ogImage: undefined,
    });
    vi.mocked(getSurveyOpenGraphMetadata).mockReturnValue({
      openGraph: {
        title: mockSurveyName,
        images: ["/api/v1/client/og?brandColor=%2364748b&name=Test%20Survey"],
        description: "Thanks a lot for your time 🙏",
      },
      twitter: {
        title: mockSurveyName,
        images: ["/api/v1/client/og?brandColor=%2364748b&name=Test%20Survey"],
        description: "Thanks a lot for your time 🙏",
      },
    });
    vi.mocked(getWorkspaceContextForLinkSurvey).mockResolvedValue({
      workspace: {
        id: "workspace-123",
        name: "Test Workspace",
        styling: { allowStyleOverwrite: true },
        logo: null,
        linkSurveyBranding: true,
        customHeadScripts: null,
      },
      customCss: null,
      organizationId: "org-123",
      organizationBilling: {
        usageCycleAnchor: new Date(),
        stripeCustomerId: null,
        limits: { workspaces: 3, monthly: { responses: 1500 } },
      },
      organizationWhitelabel: null,
    });
  });

  test("returns correct metadata for a valid link survey", async () => {
    const mockSurvey = {
      id: mockSurveyId,
      name: mockSurveyName,
      type: "link",
      status: "published",
    } as any;

    vi.mocked(getSurveyWithMetadata).mockResolvedValue(mockSurvey);

    const result = await getMetadataForLinkSurvey(mockSurveyId);

    expect(getSurveyWithMetadata).toHaveBeenCalledWith(mockSurveyId);
    expect(getBasicSurveyMetadata).toHaveBeenCalledWith(mockSurveyId, undefined, mockSurvey, []);
    expect(getSurveyOpenGraphMetadata).toHaveBeenCalledWith(mockSurveyId, mockOgTitle, undefined);

    expect(result).toEqual({
      title: mockSurveyName,
      description: mockDescription,
      openGraph: {
        title: mockSurveyName,
        description: mockDescription,
        images: ["/api/v1/client/og?brandColor=%2364748b&name=Test%20Survey"],
      },
      twitter: {
        title: mockSurveyName,
        description: mockDescription,
        images: ["/api/v1/client/og?brandColor=%2364748b&name=Test%20Survey"],
      },
      alternates: {
        canonical: `/s/${mockSurveyId}`,
      },
      robots: {
        index: false,
        follow: true,
        googleBot: {
          index: false,
          follow: true,
          noimageindex: true,
        },
      },
    });
  });

  test("returns correct metadata with custom ogImage", async () => {
    const mockSurvey = {
      id: mockSurveyId,
      name: mockSurveyName,
      type: "link",
      status: "published",
    } as any;

    vi.mocked(getSurveyWithMetadata).mockResolvedValue(mockSurvey);
    vi.mocked(getBasicSurveyMetadata).mockResolvedValue({
      title: mockSurveyName,
      ogTitle: mockOgTitle,
      description: mockDescription,
      survey: null,
      ogImage: mockOgImageUrl as any,
    });

    const result = await getMetadataForLinkSurvey(mockSurveyId);

    expect(result.openGraph?.images).toEqual(mockOgImageUrl);
    expect(result.twitter?.images).toEqual(mockOgImageUrl);
  });

  test("calls notFound when survey type is not link", async () => {
    const mockSurvey = {
      id: mockSurveyId,
      name: mockSurveyName,
      type: "app",
      status: "published",
    };

    vi.mocked(getSurveyWithMetadata).mockResolvedValue(mockSurvey as any);

    await getMetadataForLinkSurvey(mockSurveyId);

    expect(notFound).toHaveBeenCalled();
  });

  test("calls notFound when survey status is draft", async () => {
    const mockSurvey = {
      id: mockSurveyId,
      name: mockSurveyName,
      type: "link",
      status: "draft",
    } as any;

    vi.mocked(getSurveyWithMetadata).mockResolvedValue(mockSurvey);

    await getMetadataForLinkSurvey(mockSurveyId);

    expect(notFound).toHaveBeenCalled();
  });

  test("calls notFound when survey is archived", async () => {
    const mockSurvey = {
      id: mockSurveyId,
      name: mockSurveyName,
      type: "link",
      status: "completed",
      archivedAt: new Date("2026-10-01T00:00:00Z"),
    } as never;

    vi.mocked(getSurveyWithMetadata).mockResolvedValue(mockSurvey);

    await getMetadataForLinkSurvey(mockSurveyId);

    expect(notFound).toHaveBeenCalled();
  });

  test("calls notFound for an unknown id, the same way as for a survey that isn't public", async () => {
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
    });
    vi.mocked(getSurveyWithMetadata).mockRejectedValue(new ResourceNotFoundError("Survey", mockSurveyId));

    await expect(getMetadataForLinkSurvey(mockSurveyId)).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(notFound).toHaveBeenCalled();
  });

  test("rethrows a loader failure that is not a missing survey", async () => {
    vi.mocked(getSurveyWithMetadata).mockRejectedValue(new DatabaseError("connection lost"));

    await expect(getMetadataForLinkSurvey(mockSurveyId)).rejects.toBeInstanceOf(DatabaseError);
    expect(notFound).not.toHaveBeenCalled();
  });

  test("handles metadata without openGraph property", async () => {
    const mockSurvey = {
      id: mockSurveyId,
      name: mockSurveyName,
      type: "link",
      status: "published",
    } as any;

    vi.mocked(getSurveyWithMetadata).mockResolvedValue(mockSurvey);
    vi.mocked(getSurveyOpenGraphMetadata).mockReturnValue({
      twitter: {
        title: mockSurveyName,
        images: ["/api/v1/client/og?brandColor=%2364748b&name=Test%20Survey"],
        description: "Thanks a lot for your time 🙏",
      },
    });

    const result = await getMetadataForLinkSurvey(mockSurveyId);

    expect(result).toEqual({
      title: mockSurveyName,
      description: mockDescription,
      twitter: {
        title: mockSurveyName,
        description: mockDescription,
        images: ["/api/v1/client/og?brandColor=%2364748b&name=Test%20Survey"],
      },
      alternates: {
        canonical: `/s/${mockSurveyId}`,
      },
      robots: {
        index: false,
        follow: true,
        googleBot: {
          index: false,
          follow: true,
          noimageindex: true,
        },
      },
    });
  });

  test("handles metadata without twitter property", async () => {
    const mockSurvey = {
      id: mockSurveyId,
      name: mockSurveyName,
      type: "link",
      status: "published",
    } as any;

    vi.mocked(getSurveyWithMetadata).mockResolvedValue(mockSurvey);
    vi.mocked(getSurveyOpenGraphMetadata).mockReturnValue({
      openGraph: {
        title: mockSurveyName,
        images: ["/api/v1/client/og?brandColor=%2364748b&name=Test%20Survey"],
        description: "Thanks a lot for your time 🙏",
      },
    });

    const result = await getMetadataForLinkSurvey(mockSurveyId);

    expect(result).toEqual({
      title: mockSurveyName,
      description: mockDescription,
      openGraph: {
        title: mockSurveyName,
        description: mockDescription,
        images: ["/api/v1/client/og?brandColor=%2364748b&name=Test%20Survey"],
      },
      alternates: {
        canonical: `/s/${mockSurveyId}`,
      },
      robots: {
        index: false,
        follow: true,
        googleBot: {
          index: false,
          follow: true,
          noimageindex: true,
        },
      },
    });
  });

  describe("getMetadataForContactSurvey", () => {
    const contactSurvey = (overrides: Record<string, unknown> = {}) =>
      ({
        id: mockSurveyId,
        name: mockSurveyName,
        workspaceId: "workspace-123",
        type: "link",
        status: "inProgress",
        archivedAt: null,
        ...overrides,
      }) as never;

    test.each([
      ["a draft", { status: "draft" }],
      ["an archived", { status: "completed", archivedAt: new Date("2026-10-01T00:00:00Z") }],
      ["an app", { type: "app" }],
    ])("gives %s survey generic metadata, never its name", async (_label, state) => {
      vi.mocked(getSurveyWithMetadata).mockResolvedValue(contactSurvey(state));

      expect(await getMetadataForContactSurvey(mockSurveyId)).toEqual(getGenericContactSurveyMetadata());
      expect(getBasicSurveyMetadata).not.toHaveBeenCalled();
    });

    test("gives a survey that can't be loaded generic metadata", async () => {
      vi.mocked(getSurveyWithMetadata).mockRejectedValue(new ResourceNotFoundError("Survey", mockSurveyId));

      expect(await getMetadataForContactSurvey(mockSurveyId)).toEqual(getGenericContactSurveyMetadata());
    });

    test("names a public survey, without the /s canonical or robots rules", async () => {
      const survey = contactSurvey();
      vi.mocked(getSurveyWithMetadata).mockResolvedValue(survey);

      const result = await getMetadataForContactSurvey(mockSurveyId, ["de"]);

      expect(getBasicSurveyMetadata).toHaveBeenCalledWith(mockSurveyId, undefined, survey, ["de"]);
      expect(result).toEqual({
        title: mockSurveyName,
        description: mockDescription,
        openGraph: {
          title: mockSurveyName,
          description: mockDescription,
          images: ["/api/v1/client/og?brandColor=%2364748b&name=Test%20Survey"],
        },
        twitter: {
          title: mockSurveyName,
          description: mockDescription,
          images: ["/api/v1/client/og?brandColor=%2364748b&name=Test%20Survey"],
        },
      });
    });
  });
});
