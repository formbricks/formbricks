import { notFound } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError, ResourceNotFoundError } from "@formbricks/types/errors";
import { generateSurveySingleUseLinkParams } from "@/lib/utils/single-use-surveys";
import { getResponseBySingleUseId, getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import { getBasicSurveyMetadata, getSurveyOpenGraphMetadata } from "./lib/metadata-utils";
import { getGenericSurveyMetadata, getMetadataForContactSurvey, getMetadataForLinkSurvey } from "./metadata";

vi.mock("@/modules/survey/link/lib/data", () => ({
  getResponseBySingleUseId: vi.fn(),
  getSurveyWithMetadata: vi.fn(),
}));

vi.mock("@/modules/survey/link/lib/workspace", () => ({
  getWorkspaceContextForLinkSurvey: vi.fn(),
}));

// The single-use check runs for real, on real HMAC tokens; see actions.test.ts.
const { KEY } = vi.hoisted(() => ({ KEY: "0123456789abcdef".repeat(4) }));
vi.mock("@/lib/env", () => ({ env: { ENCRYPTION_KEY: KEY, SINGLE_USE_LEGACY_UNSIGNED_UNTIL: undefined } }));
vi.mock("@/lib/constants", async (importOriginal: () => Promise<typeof import("@/lib/constants")>) => ({
  ...(await importOriginal()),
  ENCRYPTION_KEY: KEY,
}));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));

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
  const answeredWith = (finished: boolean) =>
    vi.mocked(getResponseBySingleUseId).mockReturnValue(async () => ({ id: "r1", finished }) as never);

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(getResponseBySingleUseId).mockReturnValue(async () => null);

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

    const result = await getMetadataForLinkSurvey({ surveyId: mockSurveyId });

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

    const result = await getMetadataForLinkSurvey({ surveyId: mockSurveyId });

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

    await getMetadataForLinkSurvey({ surveyId: mockSurveyId });

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

    await getMetadataForLinkSurvey({ surveyId: mockSurveyId });

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

    await getMetadataForLinkSurvey({ surveyId: mockSurveyId });

    expect(notFound).toHaveBeenCalled();
  });

  test("calls notFound for an unknown id, the same way as for a survey that isn't public", async () => {
    vi.mocked(notFound).mockImplementation(() => {
      throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
    });
    vi.mocked(getSurveyWithMetadata).mockRejectedValue(new ResourceNotFoundError("Survey", mockSurveyId));

    await expect(getMetadataForLinkSurvey({ surveyId: mockSurveyId })).rejects.toThrow(
      "NEXT_HTTP_ERROR_FALLBACK;404"
    );
    expect(notFound).toHaveBeenCalled();
  });

  test("rethrows a loader failure that is not a missing survey", async () => {
    vi.mocked(getSurveyWithMetadata).mockRejectedValue(new DatabaseError("connection lost"));

    await expect(getMetadataForLinkSurvey({ surveyId: mockSurveyId })).rejects.toBeInstanceOf(DatabaseError);
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

    const result = await getMetadataForLinkSurvey({ surveyId: mockSurveyId });

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

    const result = await getMetadataForLinkSurvey({ surveyId: mockSurveyId });

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

  describe("a single-use survey (ENG-4041)", () => {
    const singleUseSurvey = {
      id: mockSurveyId,
      name: mockSurveyName,
      type: "link",
      status: "inProgress",
      archivedAt: null,
      singleUse: { enabled: true, isEncrypted: false },
    } as never;
    const indexingRules = {
      alternates: { canonical: `/s/${mockSurveyId}` },
      robots: { index: false, follow: true, googleBot: { index: false, follow: true, noimageindex: true } },
    };

    test.each([
      ["no link", {}],
      ["a forged token", { suId: "invitee-1", suToken: "0".repeat(64) }],
      ["a repeated suId", { suId: ["invitee-1", "invitee-2"], suToken: "0".repeat(64) }],
    ])("opened with %s gets generic metadata that never names it, and stays unindexed", async (_l, link) => {
      vi.mocked(getSurveyWithMetadata).mockResolvedValue(singleUseSurvey);

      const result = await getMetadataForLinkSurvey({ surveyId: mockSurveyId, ...link });

      expect(result).toEqual({ ...getGenericSurveyMetadata(), ...indexingRules });
      expect(getBasicSurveyMetadata).not.toHaveBeenCalled();
      expect(getWorkspaceContextForLinkSurvey).not.toHaveBeenCalled();
    });

    test("opened with a valid link is named as usual", async () => {
      vi.mocked(getSurveyWithMetadata).mockResolvedValue(singleUseSurvey);
      const link = generateSurveySingleUseLinkParams(mockSurveyId, false);

      const result = await getMetadataForLinkSurvey({ surveyId: mockSurveyId, ...link });

      expect(result).toMatchObject({ title: mockSurveyName, ...indexingRules });
    });

    test("opened with a link that has already been answered gets generic metadata, like the actions' not found", async () => {
      vi.mocked(getSurveyWithMetadata).mockResolvedValue(singleUseSurvey);
      const link = generateSurveySingleUseLinkParams(mockSurveyId, false);
      answeredWith(true);

      const result = await getMetadataForLinkSurvey({ surveyId: mockSurveyId, ...link });

      expect(result).toEqual({ ...getGenericSurveyMetadata(), ...indexingRules });
      expect(getResponseBySingleUseId).toHaveBeenCalledWith(mockSurveyId, link.suId);
      expect(getBasicSurveyMetadata).not.toHaveBeenCalled();
    });

    test("opened with a link whose response is only partly answered is still named, since it resumes", async () => {
      vi.mocked(getSurveyWithMetadata).mockResolvedValue(singleUseSurvey);
      answeredWith(false);

      const result = await getMetadataForLinkSurvey({
        surveyId: mockSurveyId,
        ...generateSurveySingleUseLinkParams(mockSurveyId, false),
      });

      expect(result).toMatchObject({ title: mockSurveyName, ...indexingRules });
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

      expect(await getMetadataForContactSurvey({ surveyId: mockSurveyId })).toEqual(
        getGenericSurveyMetadata()
      );
      expect(getBasicSurveyMetadata).not.toHaveBeenCalled();
    });

    test("gives a survey that can't be loaded generic metadata", async () => {
      vi.mocked(getSurveyWithMetadata).mockRejectedValue(new ResourceNotFoundError("Survey", mockSurveyId));

      expect(await getMetadataForContactSurvey({ surveyId: mockSurveyId })).toEqual(
        getGenericSurveyMetadata()
      );
    });

    test("gives a single-use survey opened without its link generic metadata (ENG-4041)", async () => {
      vi.mocked(getSurveyWithMetadata).mockResolvedValue(
        contactSurvey({ singleUse: { enabled: true, isEncrypted: false } })
      );

      expect(await getMetadataForContactSurvey({ surveyId: mockSurveyId })).toEqual(
        getGenericSurveyMetadata()
      );
      expect(getBasicSurveyMetadata).not.toHaveBeenCalled();
    });

    test("names a single-use survey opened with a valid link", async () => {
      vi.mocked(getSurveyWithMetadata).mockResolvedValue(
        contactSurvey({ singleUse: { enabled: true, isEncrypted: false } })
      );
      const link = generateSurveySingleUseLinkParams(mockSurveyId, false);

      expect(await getMetadataForContactSurvey({ surveyId: mockSurveyId, ...link })).toMatchObject({
        title: mockSurveyName,
      });
    });

    test("gives a single-use survey opened with an already answered link generic metadata", async () => {
      vi.mocked(getSurveyWithMetadata).mockResolvedValue(
        contactSurvey({ singleUse: { enabled: true, isEncrypted: false } })
      );
      const link = generateSurveySingleUseLinkParams(mockSurveyId, false);
      answeredWith(true);

      expect(await getMetadataForContactSurvey({ surveyId: mockSurveyId, ...link })).toEqual(
        getGenericSurveyMetadata()
      );
      expect(getBasicSurveyMetadata).not.toHaveBeenCalled();
    });

    test("names a public survey, without the /s canonical or robots rules", async () => {
      const survey = contactSurvey();
      vi.mocked(getSurveyWithMetadata).mockResolvedValue(survey);

      const result = await getMetadataForContactSurvey({ surveyId: mockSurveyId, acceptedLanguages: ["de"] });

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
