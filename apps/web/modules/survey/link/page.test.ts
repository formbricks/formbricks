import { beforeEach, describe, expect, test, vi } from "vitest";
import { findMatchingLocale, getAcceptedLanguages } from "@/lib/utils/locale";
import { renderSurvey } from "@/modules/survey/link/components/survey-renderer";
import { getResponseBySingleUseId } from "@/modules/survey/link/lib/data";
import { getServableLinkSurvey } from "@/modules/survey/link/lib/servable-survey";
import { getLinkSurveySingleUseAccess } from "@/modules/survey/link/lib/single-use-link";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import { LinkSurveyPage } from "./page";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/lib/utils/locale", () => ({ findMatchingLocale: vi.fn(), getAcceptedLanguages: vi.fn() }));
vi.mock("@/modules/survey/lib/response", () => ({ getResponseCountBySurveyId: vi.fn() }));
vi.mock("@/modules/survey/link/components/survey-inactive", () => ({ SurveyInactive: vi.fn() }));
vi.mock("@/modules/survey/link/components/survey-renderer", () => ({ renderSurvey: vi.fn() }));
vi.mock("@/modules/survey/link/lib/data", () => ({ getResponseBySingleUseId: vi.fn() }));
vi.mock("@/modules/survey/link/lib/servable-survey", () => ({ getServableLinkSurvey: vi.fn() }));
vi.mock("@/modules/survey/link/lib/single-use-link", () => ({ getLinkSurveySingleUseAccess: vi.fn() }));
vi.mock("@/modules/survey/link/lib/workspace", () => ({ getWorkspaceContextForLinkSurvey: vi.fn() }));
vi.mock("@/modules/survey/link/metadata", () => ({ getMetadataForLinkSurvey: vi.fn() }));

const surveyId = "clsurvey00000000000000000";

describe("LinkSurveyPage single-use response handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getServableLinkSurvey).mockResolvedValue({
      id: surveyId,
      status: "inProgress",
      workspaceId: "workspace-1",
      welcomeCard: { showResponseCount: false },
    } as never);
    vi.mocked(getLinkSurveySingleUseAccess).mockReturnValue({
      allowed: true,
      singleUseId: "single-use-1",
    } as never);
    vi.mocked(getResponseBySingleUseId).mockReturnValue(
      async () =>
        ({
          id: "response-1",
          finished: false,
          data: { answer: "private answer" },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }) as never
    );
    vi.mocked(getWorkspaceContextForLinkSurvey).mockResolvedValue({ workspace: {} } as never);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US" as never);
    vi.mocked(getAcceptedLanguages).mockResolvedValue([]);
  });

  test("passes only response status to the PIN renderer and returns its output", async () => {
    const renderResult = { rendered: true };
    vi.mocked(renderSurvey).mockResolvedValue(renderResult as never);

    const result = await LinkSurveyPage({
      params: Promise.resolve({ surveyId }),
      searchParams: Promise.resolve({ suId: "single-use-1", suToken: "token" }),
    });

    expect(renderSurvey).toHaveBeenCalledWith(
      expect.objectContaining({ singleUseResponse: { id: "response-1", finished: false } })
    );
    expect(result).toBe(renderResult);
  });
});
