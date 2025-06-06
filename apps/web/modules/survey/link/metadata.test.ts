import { COLOR_DEFAULTS } from "@/lib/styling/constants";
import { getSurveyMetadata } from "@/modules/survey/link/lib/data";
import { notFound } from "next/navigation";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { getBrandColorForURL, getNameForURL, getSurveyOpenGraphMetadata } from "./lib/metadata-utils";
import { getMetadataForLinkSurvey } from "./metadata";

vi.mock("@/modules/survey/link/lib/data", () => ({
  getSurveyMetadata: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("./lib/metadata-utils", () => ({
  getBrandColorForURL: vi.fn(),
  getNameForURL: vi.fn(),
  getSurveyOpenGraphMetadata: vi.fn(),
}));

describe("getMetadataForLinkSurvey", () => {
  const mockSurveyId = "survey-123";
  const mockSurveyName = "Test Survey";
  const mockBrandColor = "#123456";
  const mockEncodedBrandColor = "123456";
  const mockEncodedName = "Test-Survey";
  const mockOgImageUrl = `/api/v1/og?brandColor=${mockEncodedBrandColor}&name=${mockEncodedName}`;

  beforeEach(() => {
    vi.resetAllMocks();

    vi.mocked(getBrandColorForURL).mockReturnValue(mockEncodedBrandColor);
    vi.mocked(getNameForURL).mockReturnValue(mockEncodedName);
    vi.mocked(getSurveyOpenGraphMetadata).mockReturnValue({
      openGraph: {
        title: mockSurveyName,
        images: [],
      },
      twitter: {
        title: mockSurveyName,
        images: [],
      },
    });
  });

  test("returns correct metadata for a valid link survey", async () => {
    const mockSurvey = {
      id: mockSurveyId,
      name: mockSurveyName,
      type: "link",
      status: "published",
      styling: {
        brandColor: {
          light: mockBrandColor,
        },
      },
    } as any;

    vi.mocked(getSurveyMetadata).mockResolvedValue(mockSurvey);

    const result = await getMetadataForLinkSurvey(mockSurveyId);

    expect(getSurveyMetadata).toHaveBeenCalledWith(mockSurveyId);
    expect(getBrandColorForURL).toHaveBeenCalledWith(mockBrandColor);
    expect(getNameForURL).toHaveBeenCalledWith(mockSurveyName);

    expect(result).toEqual({
      title: mockSurveyName,
      openGraph: {
        title: mockSurveyName,
        images: [mockOgImageUrl],
      },
      twitter: {
        title: mockSurveyName,
        images: [mockOgImageUrl],
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

  test("uses default brand color when styling is not defined", async () => {
    const mockSurvey = {
      id: mockSurveyId,
      name: mockSurveyName,
      type: "link",
      status: "published",
    } as any;

    vi.mocked(getSurveyMetadata).mockResolvedValue(mockSurvey);

    await getMetadataForLinkSurvey(mockSurveyId);

    expect(getBrandColorForURL).toHaveBeenCalledWith(COLOR_DEFAULTS.brandColor);
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
        images: [],
      },
    });

    const result = await getMetadataForLinkSurvey(mockSurveyId);

    expect(result).toEqual({
      title: mockSurveyName,
      twitter: {
        title: mockSurveyName,
        images: [mockOgImageUrl],
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
        images: [],
      },
    });

    const result = await getMetadataForLinkSurvey(mockSurveyId);

    expect(result).toEqual({
      title: mockSurveyName,
      openGraph: {
        title: mockSurveyName,
        images: [mockOgImageUrl],
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
