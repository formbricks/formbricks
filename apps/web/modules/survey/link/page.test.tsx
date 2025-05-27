import { validateSurveySingleUseId } from "@/app/lib/singleUseSurveys";
import { getSurvey } from "@/modules/survey/lib/survey";
import { renderSurvey } from "@/modules/survey/link/components/survey-renderer";
import { getResponseBySingleUseId } from "@/modules/survey/link/lib/response";
import { getMetadataForLinkSurvey } from "@/modules/survey/link/metadata";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { notFound } from "next/navigation";
import { afterEach, describe, expect, test, vi } from "vitest";
import { TResponseData } from "@formbricks/types/responses";
import { TSurvey } from "@formbricks/types/surveys/types";
import { LinkSurveyPage, generateMetadata } from "./page";

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
  SurveyInactive: vi.fn(() => <div data-testid="survey-inactive" />),
}));

vi.mock("@/modules/survey/link/components/survey-renderer", () => ({
  renderSurvey: vi.fn(() => <div data-testid="survey-renderer" />),
}));

vi.mock("@/modules/survey/link/lib/response", () => ({
  getResponseBySingleUseId: vi.fn(),
}));

vi.mock("@/modules/survey/link/metadata", () => ({
  getMetadataForLinkSurvey: vi.fn(),
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
    vi.mocked(getSurvey).mockResolvedValue(mockSurvey);

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({}),
    };

    await LinkSurveyPage(props);

    expect(getSurvey).toHaveBeenCalledWith("survey123");
    expect(renderSurvey).toHaveBeenCalledWith({
      survey: mockSurvey,
      searchParams: {},
      singleUseId: undefined,
      singleUseResponse: undefined,
      isPreview: false,
    });
  });

  test("LinkSurveyPage handles encrypted single use with valid ID", async () => {
    vi.mocked(getSurvey).mockResolvedValue({
      ...mockSurvey,
      singleUse: {
        enabled: true,
        isEncrypted: true,
      },
    } as unknown as TSurvey);
    vi.mocked(validateSurveySingleUseId).mockReturnValue("validatedId123");
    vi.mocked(getResponseBySingleUseId).mockResolvedValue(null);

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
    vi.mocked(getSurvey).mockResolvedValue({
      ...mockSurvey,
      singleUse: {
        enabled: true,
        isEncrypted: false,
      },
    } as unknown as TSurvey);
    vi.mocked(getResponseBySingleUseId).mockResolvedValue(null);

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({ suId: "plainId123" }),
    };

    await LinkSurveyPage(props);

    expect(getResponseBySingleUseId).toHaveBeenCalledWith("survey123", "plainId123");
    expect(renderSurvey).toHaveBeenCalled();
  });

  test("LinkSurveyPage passes existing single use response when available", async () => {
    const mockResponse = { id: "response123" } as unknown as TResponseData;

    vi.mocked(getSurvey).mockResolvedValue({
      ...mockSurvey,
      singleUse: {
        enabled: true,
        isEncrypted: false,
      },
    } as unknown as TSurvey);
    vi.mocked(getResponseBySingleUseId).mockResolvedValue(mockResponse as any);

    const props = {
      params: Promise.resolve({ surveyId: "survey123" }),
      searchParams: Promise.resolve({ suId: "plainId123" }),
    };

    await LinkSurveyPage(props);

    expect(renderSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        singleUseResponse: mockResponse,
      })
    );
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
});
