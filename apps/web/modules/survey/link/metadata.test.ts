import { getSurveyMetadata } from "@/modules/survey/link/lib/data";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getBasicSurveyMetadata, getSurveyOpenGraphMetadata } from "./lib/metadata-utils";
import { getMetadataForLinkSurvey } from "./metadata";

vi.mock("@/modules/survey/link/lib/data", () => ({
  getSurveyMetadata: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("./lib/metadata-utils", () => ({
  getSurveyOpenGraphMetadata: vi.fn(),
  getBasicSurveyMetadata: vi.fn(),
}));

describe("getMetadataForLinkSurvey", () => {
  const mockSurveyId = "survey-123";
  const mockSurveyName = "Test Survey";
  const mockDescription = "Please complete this survey.";
  const mockOgImageUrl = "https://example.com/custom-image.png";

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(getBasicSurveyMetadata).mockResolvedValue({
      title: mockSurveyName,
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
  });

  test("returns correct metadata for a valid link survey", async () => {
    const mockSurvey = {
      id: mockSurveyId,
      name: mockSurveyName,
      type: "link",
      status: "published",
    } as any;

    vi.mocked(getSurveyMetadata).mockResolvedValue(mockSurvey);

    const result = await getMetadataForLinkSurvey(mockSurveyId);

    expect(getSurveyMetadata).toHaveBeenCalledWith(mockSurveyId);
    expect(getBasicSurveyMetadata).toHaveBeenCalledWith(mockSurveyId, undefined);
    expect(getSurveyOpenGraphMetadata).toHaveBeenCalledWith(mockSurveyId, mockSurveyName, undefined);

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

    vi.mocked(getSurveyMetadata).mockResolvedValue(mockSurvey);
    vi.mocked(getBasicSurveyMetadata).mockResolvedValue({
      title: mockSurveyName,
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

    vi.mocked(getSurveyMetadata).mockResolvedValue(mockSurvey as any);

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

    vi.mocked(getSurveyMetadata).mockResolvedValue(mockSurvey);

    await getMetadataForLinkSurvey(mockSurveyId);

    expect(notFound).toHaveBeenCalled();
  });

  test("handles metadata without openGraph property", async () => {
    const mockSurvey = {
      id: mockSurveyId,
      name: mockSurveyName,
      type: "link",
      status: "published",
    } as any;

    vi.mocked(getSurveyMetadata).mockResolvedValue(mockSurvey);
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

    vi.mocked(getSurveyMetadata).mockResolvedValue(mockSurvey);
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
});
