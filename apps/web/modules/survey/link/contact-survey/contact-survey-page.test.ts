import { createInstance } from "i18next";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { findMatchingLocale, getAcceptedLanguages } from "@/lib/utils/locale";
import { getTranslate } from "@/lingodotdev/server";
import { verifyContactSurveyToken } from "@/modules/ee/contacts/lib/contact-survey-link";
import { SurveyInactive } from "@/modules/survey/link/components/survey-inactive";
import { renderSurvey } from "@/modules/survey/link/components/survey-renderer";
import { getExistingContactResponse, getResponseBySingleUseId } from "@/modules/survey/link/lib/data";
import { getServableLinkSurvey } from "@/modules/survey/link/lib/servable-survey";
import { getLinkSurveySingleUseAccess } from "@/modules/survey/link/lib/single-use-link";
import { getWorkspaceContextForLinkSurvey } from "@/modules/survey/link/lib/workspace";
import { getMetadataForContactSurvey } from "@/modules/survey/link/metadata";
import { ContactSurveyPage, generateMetadata } from "./page";

vi.mock("next/navigation", () => ({ notFound: vi.fn() }));
// The real generic metadata below loads the env through its imports.
vi.mock("@/lib/env", () => ({ env: {} }));
vi.mock("@formbricks/logger", () => ({ logger: { warn: vi.fn(), error: vi.fn() } }));
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
vi.mock("@/modules/survey/link/metadata", async (importOriginal) => ({
  // The real generic metadata, so the tests below see what an invalid or expired token sends.
  getGenericSurveyMetadata: (await importOriginal<typeof import("@/modules/survey/link/metadata")>())
    .getGenericSurveyMetadata,
  getMetadataForContactSurvey: vi.fn(),
}));

describe("ContactSurveyPage single-use response handoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getResponseBySingleUseId).mockReturnValue(
      async () =>
        ({
          id: "response-1",
          finished: false,
          data: { answer: "private answer" },
          createdAt: new Date("2026-01-01T00:00:00.000Z"),
        }) as never
    );
    vi.mocked(getExistingContactResponse).mockReturnValue(async () => undefined);
    vi.mocked(getServableLinkSurvey).mockResolvedValue({
      id: "survey-1",
      status: "inProgress",
      workspaceId: "workspace-1",
      welcomeCard: { showResponseCount: false },
    } as never);
    vi.mocked(getLinkSurveySingleUseAccess).mockReturnValue({
      allowed: true,
      singleUseId: "single-use-1",
    });
    vi.mocked(verifyContactSurveyToken).mockReturnValue({
      ok: true,
      data: { surveyId: "survey-1", contactId: "contact-1" },
    } as never);
    vi.mocked(getTranslate).mockResolvedValue(createInstance().getFixedT("en-US"));
    vi.mocked(getWorkspaceContextForLinkSurvey).mockResolvedValue({ workspace: {} } as never);
    vi.mocked(findMatchingLocale).mockResolvedValue("en-US");
    vi.mocked(getAcceptedLanguages).mockResolvedValue([]);
  });

  test("passes an unfinished response id to the renderer so the respondent can resume it", async () => {
    const renderResult = { rendered: true };
    vi.mocked(renderSurvey).mockResolvedValue(renderResult as never);

    const result = await ContactSurveyPage({
      params: Promise.resolve({ jwt: "contact-token" }),
      searchParams: Promise.resolve({ suId: "single-use-1", suToken: "token" }),
    });

    expect(renderSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        singleUseResponse: { id: "response-1", finished: false },
      })
    );
    expect(result).toBe(renderResult);
  });

  test("does not reject an unfinished contact response before checking the single-use response", async () => {
    vi.mocked(getExistingContactResponse).mockReturnValue(async () => ({
      id: "response-1",
      finished: false,
    }));

    await ContactSurveyPage({
      params: Promise.resolve({ jwt: "contact-token" }),
      searchParams: Promise.resolve({ suId: "single-use-1", suToken: "token" }),
    });

    expect(getResponseBySingleUseId).toHaveBeenCalledWith("survey-1", "single-use-1");
    expect(SurveyInactive).not.toHaveBeenCalled();
    expect(renderSurvey).toHaveBeenCalled();
  });

  test("keeps the submitted response screen for a finished contact response", async () => {
    vi.mocked(getExistingContactResponse).mockReturnValue(async () => ({ id: "response-1", finished: true }));

    const result = await ContactSurveyPage({
      params: Promise.resolve({ jwt: "contact-token" }),
      searchParams: Promise.resolve({ suId: "single-use-1", suToken: "token" }),
    });

    expect(result).toMatchObject({ type: SurveyInactive, props: { status: "response submitted" } });
    expect(getResponseBySingleUseId).not.toHaveBeenCalled();
  });

  test("resumes the contact's own unfinished response when the link is not single-use", async () => {
    vi.mocked(getLinkSurveySingleUseAccess).mockReturnValue({ allowed: true });
    vi.mocked(getExistingContactResponse).mockReturnValue(async () => ({
      id: "contact-response-1",
      finished: false,
    }));

    await ContactSurveyPage({
      params: Promise.resolve({ jwt: "contact-token" }),
      searchParams: Promise.resolve({}),
    });

    expect(getResponseBySingleUseId).not.toHaveBeenCalled();
    expect(renderSurvey).toHaveBeenCalledWith(
      expect.objectContaining({
        singleUseResponse: { id: "contact-response-1", finished: false },
      })
    );
  });
});

// A personal link that ends up public must not be indexed, even when its token no longer names a survey
// (ENG-7436).
describe("ContactSurveyPage metadata", () => {
  const noIndexRules = {
    index: false,
    follow: true,
    googleBot: { index: false, follow: true, noimageindex: true },
  };
  const props = {
    params: Promise.resolve({ jwt: "contact-token" }),
    searchParams: Promise.resolve({}),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAcceptedLanguages).mockResolvedValue([]);
  });

  test.each(["invalid_token", "token_expired"])(
    "asks search engines not to index the generic page for a token rejected as %s",
    async (issue) => {
      vi.mocked(verifyContactSurveyToken).mockReturnValue({
        ok: false,
        error: { type: "bad_request", details: [{ field: "token", issue }] },
      });

      const metadata = await generateMetadata(props);

      expect(metadata).toMatchObject({ title: "Survey", robots: noIndexRules });
      expect(getMetadataForContactSurvey).not.toHaveBeenCalled();
    }
  );

  test("asks search engines not to index the generic page when verifying the token throws", async () => {
    vi.mocked(verifyContactSurveyToken).mockImplementation(() => {
      throw new Error("boom");
    });

    expect((await generateMetadata(props)).robots).toEqual(noIndexRules);
  });
});
