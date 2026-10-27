import { beforeEach, describe, expect, test, vi } from "vitest";
import { findMatchingLocale, getAcceptedLanguages } from "@/lib/utils/locale";
import { getTranslate } from "@/lingodotdev/server";
import { verifyContactSurveyToken } from "@/modules/ee/contacts/lib/contact-survey-link";
import { renderSurvey } from "@/modules/survey/link/components/survey-renderer";
import { getExistingContactResponse, getResponseBySingleUseId } from "@/modules/survey/link/lib/data";
import { getServableLinkSurvey } from "@/modules/survey/link/lib/servable-survey";
import { getLinkSurveySingleUseAccess } from "@/modules/survey/link/lib/single-use-link";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import { ContactSurveyPage } from "./page";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
vi.mock("@/lib/utils/locale", () => ({ findMatchingLocale: vi.fn(), getAcceptedLanguages: vi.fn() }));
vi.mock("@/lingodotdev/server", () => ({ getTranslate: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/contact-survey-link", () => ({ verifyContactSurveyToken: vi.fn() }));
vi.mock("@/modules/survey/lib/response", () => ({ getResponseCountBySurveyId: vi.fn() }));
vi.mock("@/modules/survey/link/components/survey-inactive", () => ({ SurveyInactive: vi.fn() }));
vi.mock("@/modules/survey/link/components/survey-renderer", () => ({ renderSurvey: vi.fn() }));
vi.mock("@/modules/survey/link/lib/data", () => ({
  getExistingContactResponse: vi.fn(),
  getResponseBySingleUseId: vi.fn(),
}));
vi.mock("@/modules/survey/link/lib/servable-survey", () => ({ getServableLinkSurvey: vi.fn() }));
vi.mock("@/modules/survey/link/lib/single-use-link", () => ({ getLinkSurveySingleUseAccess: vi.fn() }));
vi.mock("@/modules/survey/link/lib/workspace", () => ({
  getWorkspaceContextForLinkSurvey: vi.fn(),
  getWorkspaceById: vi.fn(),
}));
vi.mock("@/modules/survey/link/metadata", () => ({
  getGenericSurveyMetadata: vi.fn(),
  getMetadataForContactSurvey: vi.fn(),
}));

describe("ContactSurveyPage single-use response handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getResponseBySingleUseId).mockReturnValue(
      async () => ({ id: "response-1", finished: false }) as never
    );
    vi.mocked(getExistingContactResponse).mockReturnValue(async () => null);
    vi.mocked(getServableLinkSurvey).mockResolvedValue({
      id: "survey-1",
      status: "inProgress",
      workspaceId: "workspace-1",
      welcomeCard: { showResponseCount: false },
    } as never);
    vi.mocked(getLinkSurveySingleUseAccess).mockReturnValue({
      allowed: true,
      singleUseId: "single-use-1",
    } as never);
    vi.mocked(verifyContactSurveyToken).mockReturnValue({
      ok: true,
      data: { surveyId: "survey-1", contactId: "contact-1" },
    } as never);
    vi.mocked(getTranslate).mockResolvedValue((key: string) => key as never);
    vi.mocked(getWorkspaceContextForLinkSurvey).mockResolvedValue({ workspace: {} } as never);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US" as never);
    vi.mocked(getAcceptedLanguages).mockResolvedValue([]);
  });

  test("passes an unfinished response id to the renderer so the respondent can resume it", async () => {
    await ContactSurveyPage({
      params: Promise.resolve({ jwt: "contact-token" }),
      searchParams: Promise.resolve({ suId: "single-use-1", suToken: "token" }),
    });

    expect(renderSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        singleUseResponse: { id: "response-1", finished: false },
      })
    );
  });
});
