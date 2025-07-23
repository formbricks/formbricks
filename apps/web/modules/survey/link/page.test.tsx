import { validateSurveySingleUseId } from "@/app/lib/singleUseSurveys";
import { getSurvey } from "@/modules/survey/lib/survey";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { renderSurvey } from "@/modules/survey/link/components/survey-renderer";
import { getResponseBySingleUseId, getSurveyWithMetadata } from "@/modules/survey/link/lib/data";
import { getProjectByEnvironmentId } from "@/modules/survey/link/lib/project";
import { getMetadataForLinkSurvey } from "@/modules/survey/link/metadata";
import "@testing-library/jest-dom/vitest";
import { cleanup, render } from "@testing-library/react";
import { notFound } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import { logger } from "@formbricks/logger";
import { TSurvey } from "@formbricks/types/surveys/types";
import { LinkSurveyPage, generateMetadata } from "./page";

// Mock server-side constants to prevent client-side access
vi.mock("@/lib/constants", () => ({
  IS_FORMBRICKS_CLOUD: false,
  IS_RECAPTCHA_CONFIGURED: false,
  RECAPTCHA_SITE_KEY: "test-key",
  IMPRINT_URL: "https://example.com/imprint",
  PRIVACY_URL: "https://example.com/privacy",
  ENCRYPTION_KEY: "0".repeat(32),
}));

// Mock dependencies
vi.mock("next/navigation", () => ({
  notFound: vi.fn(),
}));

vi.mock("@/app/lib/singleUseSurveys", () => ({
  validateSurveySingleUseId: vi.fn(),
}));

vi.mock("@/modules/survey/lib/survey", () => ({
  getSurvey: vi.fn(),
}));

vi.mock("@/modules/survey/link/components/survey-inactive", () => ({
  SurveyInactive: vi.fn(() => <div>Survey Inactive</div>),
}));

vi.mock("@/modules/survey/link/components/survey-renderer", () => ({
  renderSurvey: vi.fn(() => <div>Render Survey</div>),
}));

vi.mock("@/modules/survey/link/lib/data", () => ({
  getResponseBySingleUseId: vi.fn(),
  getSurveyWithMetadata: vi.fn(),
}));

vi.mock("@/modules/survey/link/lib/project", () => ({
  getProjectByEnvironmentId: vi.fn(),
}));

vi.mock("@/modules/survey/link/metadata", () => ({
  getMetadataForLinkSurvey: vi.fn(),
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe("LinkSurveyPage", () => {
  afterEach(() => {
    cleanup();
    vi.resetAllMocks();
  });

  const mockSurvey = {
    id: "survey123",
    singleUse: {
      enabled: false,
      isEncrypted: false,
    },
  } as unknown as TSurvey;

  test("generateMetadata returns metadata for valid survey ID", async () => {
    const mockMetadata = { title: "Survey Title" };
    vi.mocked(getMetadataForLinkSurvey).mockResolvedValue(mockMetadata);

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({}),
    };

    const result = await generateMetadata(props);

    expect(getMetadataForLinkSurvey).toHaveBeenCalledWith("survey123");
    expect(result).toEqual(mockMetadata);
  });

  test("generateMetadata calls notFound for invalid survey ID", async () => {
    const props = {
      params: Promise.resolve({ surveyId: "invalid-id!" }),
      searchParams: Promise.resolve({}),
    };

    await generateMetadata(props);

    expect(notFound).toHaveBeenCalled();
  });

  test("LinkSurveyPage calls notFound for invalid survey ID", async () => {
    const props = {
      params: Promise.resolve({ surveyId: "invalid-id!" }),
      searchParams: Promise.resolve({}),
    };

    await LinkSurveyPage(props);

    expect(notFound).toHaveBeenCalled();
  });

  test("LinkSurveyPage renders survey for valid ID", async () => {
    vi.mocked(getSurveyWithMetadata).mockResolvedValue(mockSurvey);

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({}),
    };

    await LinkSurveyPage(props);

    expect(getSurveyWithMetadata).toHaveBeenCalledWith("survey123");
    expect(renderSurvey).toHaveBeenCalledWith({
      survey: mockSurvey,
      searchParams: {},
      singleUseId: undefined,
      singleUseResponse: undefined,
      isPreview: false,
    });
  });

  test("LinkSurveyPage handles encrypted single use with valid ID", async () => {
    vi.mocked(getSurveyWithMetadata).mockResolvedValue({
      ...mockSurvey,
      singleUse: {
        enabled: true,
        isEncrypted: true,
      },
    } as unknown as TSurvey);
    vi.mocked(validateSurveySingleUseId).mockReturnValue("validatedId123");
    vi.mocked(getResponseBySingleUseId).mockReturnValue(() => Promise.resolve(null));

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({ suId: "encryptedId123" }),
    };

    await LinkSurveyPage(props);

    expect(validateSurveySingleUseId).toHaveBeenCalledWith("encryptedId123");
    expect(getResponseBySingleUseId).toHaveBeenCalledWith("survey123", "validatedId123");
    expect(renderSurvey).toHaveBeenCalled();
  });

  test("LinkSurveyPage handles non-encrypted single use ID", async () => {
    vi.mocked(getSurveyWithMetadata).mockResolvedValue({
      ...mockSurvey,
      singleUse: {
        enabled: true,
        isEncrypted: false,
      },
    } as unknown as TSurvey);
    vi.mocked(getResponseBySingleUseId).mockReturnValue(() => Promise.resolve(null));

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({ suId: "plainId123" }),
    };

    await LinkSurveyPage(props);

    expect(getResponseBySingleUseId).toHaveBeenCalledWith("survey123", "plainId123");
    expect(renderSurvey).toHaveBeenCalled();
  });

  test("LinkSurveyPage passes existing single use response when available", async () => {
    const mockResponse = {
      id: "response123",
      createdAt: new Date(),
      data: {} as Record<string, string | number | Record<string, string> | string[]>,
      finished: true,
    };

    vi.mocked(getSurveyWithMetadata).mockResolvedValue({
      ...mockSurvey,
      singleUse: {
        enabled: true,
        isEncrypted: false,
      },
    } as unknown as TSurvey);

    vi.mocked(getResponseBySingleUseId).mockReturnValue(async () => mockResponse);

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({ suId: "plainId123" }),
    };

    await LinkSurveyPage(props);

    expect(getResponseBySingleUseId).toHaveBeenCalledWith("survey123", "plainId123");
    expect(renderSurvey).toHaveBeenCalledWith({
      survey: expect.any(Object),
      searchParams: { suId: "plainId123" },
      singleUseId: "plainId123",
      singleUseResponse: mockResponse,
      isPreview: false,
    });
  });

  test("LinkSurveyPage handles preview mode", async () => {
    vi.mocked(getSurvey).mockResolvedValue(mockSurvey);

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({ preview: "true" }),
    };

    await LinkSurveyPage(props);

    expect(renderSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        isPreview: true,
      })
    );
  });

  test("LinkSurveyPage handles error in getResponseBySingleUseId", async () => {
    vi.mocked(getSurvey).mockResolvedValue({
      ...mockSurvey,
      singleUse: {
        enabled: true,
        isEncrypted: false,
      },
    } as unknown as TSurvey);
    vi.mocked(getResponseBySingleUseId).mockRejectedValue(new Error("Database error"));

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({ suId: "plainId123" }),
    };

    await LinkSurveyPage(props);

    expect(renderSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        singleUseResponse: undefined,
      })
    );
  });

  test("should show 'link invalid' for single-use survey without suId", async () => {
    const singleUseSurvey = { ...mockSurvey, singleUse: { enabled: true, isEncrypted: false } };
    vi.mocked(getSurveyWithMetadata).mockResolvedValue(singleUseSurvey);
    vi.mocked(getProjectByEnvironmentId).mockResolvedValue({ id: "proj-123" } as any);

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({}),
    };
    const Page = await LinkSurveyPage(props);
    render(Page);

    expect(vi.mocked(SurveyInactive).mock.calls[0][0]).toEqual({
      status: "link invalid",
      project: { id: "proj-123" },
    });
  });

  test("should show 'link invalid' for encrypted single-use survey with invalid suId", async () => {
    const singleUseSurvey = { ...mockSurvey, singleUse: { enabled: true, isEncrypted: true } };
    vi.mocked(getSurveyWithMetadata).mockResolvedValue(singleUseSurvey);
    vi.mocked(validateSurveySingleUseId).mockReturnValue(undefined);
    vi.mocked(getProjectByEnvironmentId).mockResolvedValue({ id: "proj-123" } as any);

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({ suId: "invalid-suid" }),
    };
    const Page = await LinkSurveyPage(props);
    render(Page);

    expect(vi.mocked(SurveyInactive).mock.calls[0][0]).toEqual({
      status: "link invalid",
      project: { id: "proj-123" },
    });
  });

  test("should render survey for encrypted single-use survey with valid suId", async () => {
    const singleUseSurvey = { ...mockSurvey, singleUse: { enabled: true, isEncrypted: true } };
    vi.mocked(getSurveyWithMetadata).mockResolvedValue(singleUseSurvey);
    vi.mocked(validateSurveySingleUseId).mockReturnValue("valid-suid");

    const mockResponseFn = vi.fn().mockResolvedValue({ id: "res-1" });
    vi.mocked(getResponseBySingleUseId).mockReturnValue(mockResponseFn);

    const props = {
      params: Promise.resolve({ surveyId: "survey-123" }),
      searchParams: Promise.resolve({ suId: "encrypted-suid" }),
    };
    const Page = await LinkSurveyPage(props);
    render(Page);

    expect(vi.mocked(renderSurvey).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        singleUseId: "valid-suid",
        singleUseResponse: { id: "res-1" },
      })
    );
  });

  test("should render survey for non-encrypted single-use survey", async () => {
    const singleUseSurvey = { ...mockSurvey, singleUse: { enabled: true, isEncrypted: false } };
    vi.mocked(getSurveyWithMetadata).mockResolvedValue(singleUseSurvey);

    const mockResponseFn = vi.fn().mockResolvedValue({ id: "res-1" });
    vi.mocked(getResponseBySingleUseId).mockReturnValue(mockResponseFn);

    const props = {
      params: Promise.resolve({ surveyId: "survey-123" }),
      searchParams: Promise.resolve({ suId: "plain-suid" }),
    };
    const Page = await LinkSurveyPage(props);
    render(Page);

    expect(vi.mocked(renderSurvey).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        singleUseId: "plain-suid",
        singleUseResponse: { id: "res-1" },
      })
    );
  });

  test("should render survey with undefined response when getResponseBySingleUseId fails", async () => {
    const singleUseSurvey = { ...mockSurvey, singleUse: { enabled: true, isEncrypted: false } };
    vi.mocked(getSurveyWithMetadata).mockResolvedValue(singleUseSurvey);

    const mockResponseFn = vi.fn().mockRejectedValue(new Error("DB error"));
    vi.mocked(getResponseBySingleUseId).mockReturnValue(mockResponseFn);

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({ suId: "plain-suid" }),
    };
    const Page = await LinkSurveyPage(props);
    render(Page);

    expect(logger.error).toHaveBeenCalled();
    expect(vi.mocked(renderSurvey).mock.calls[0][0]).toEqual(
      expect.objectContaining({
        singleUseId: "plain-suid",
        singleUseResponse: undefined,
      })
    );
  });

  test("should handle missing project for single-use survey without suId", async () => {
    const singleUseSurvey = { ...mockSurvey, singleUse: { enabled: true, isEncrypted: false } };
    vi.mocked(getSurveyWithMetadata).mockResolvedValue(singleUseSurvey);
    vi.mocked(getProjectByEnvironmentId).mockResolvedValue(null);

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({}),
    };
    const Page = await LinkSurveyPage(props);
    render(Page);

    expect(vi.mocked(SurveyInactive).mock.calls[0][0]).toEqual({
      status: "link invalid",
      project: undefined,
    });
  });

  test("LinkSurveyPage calls notFound when getSurveyWithMetadata throws an error", async () => {
    const databaseError = new Error("Database connection failed");
    vi.mocked(getSurveyWithMetadata).mockRejectedValue(databaseError);

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({}),
    };

    await LinkSurveyPage(props);

    expect(getSurveyWithMetadata).toHaveBeenCalledWith("survey123");
    expect(logger.error).toHaveBeenCalledWith(databaseError, "Error fetching survey");
    expect(notFound).toHaveBeenCalled();
  });
});

describe("generateMetadata", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should call notFound for invalid surveyId", async () => {
    const props = {
      params: Promise.resolve({ surveyId: "invalid-id" }),
      searchParams: Promise.resolve({}),
    };
    await generateMetadata(props);
    expect(notFound).toHaveBeenCalled();
  });

  test("should call getMetadataForLinkSurvey for valid surveyId", async () => {
    vi.mocked(getMetadataForLinkSurvey).mockResolvedValue({ title: "Test Survey" });
    const props = {
      params: Promise.resolve({ surveyId: "survey-123" }),
      searchParams: Promise.resolve({}),
    };
    const metadata = await generateMetadata(props);
    expect(getMetadataForLinkSurvey).toHaveBeenCalledWith("survey-123");
    expect(metadata).toEqual({ title: "Test Survey" });
  });
});
