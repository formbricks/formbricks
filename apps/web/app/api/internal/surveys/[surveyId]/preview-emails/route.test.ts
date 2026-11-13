import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError, ResourceNotFoundError, TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  getSurvey: vi.fn(),
  getOrganizationIdFromSurveyId: vi.fn(),
  getOrganizationLogoUrl: vi.fn(),
  getEmailTemplateHtml: vi.fn(),
  sendEmbedSurveyPreviewEmail: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/user/service", () => ({ getUser: mocks.getUser }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: mocks.getSurvey }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromSurveyId: mocks.getOrganizationIdFromSurveyId }));
vi.mock("@/modules/ee/whitelabel/email-customization/lib/organization", () => ({
  getOrganizationLogoUrl: mocks.getOrganizationLogoUrl,
}));
vi.mock(
  "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplate",
  () => ({ getEmailTemplateHtml: mocks.getEmailTemplateHtml })
);
vi.mock("@/modules/email", () => ({ sendEmbedSurveyPreviewEmail: mocks.sendEmbedSurveyPreviewEmail }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const SURVEY_ID = "clsurvey11111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const actor = { type: "user", id: USER_ID };

const send = ({ headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}) =>
  POST(
    new NextRequest(`http://localhost/api/internal/surveys/${SURVEY_ID}/preview-emails`, {
      method: "POST",
      headers,
    }),
    { params: Promise.resolve({ surveyId: SURVEY_ID }) } as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.getUser.mockResolvedValue({ id: USER_ID, email: "test@example.com", locale: "de-DE" });
  mocks.getOrganizationIdFromSurveyId.mockResolvedValue(ORG_ID);
  mocks.getOrganizationLogoUrl.mockResolvedValue("https://example.com/logo.png");
  mocks.getSurvey.mockResolvedValue({ id: SURVEY_ID, workspaceId: WORKSPACE_ID });
  mocks.getEmailTemplateHtml.mockResolvedValue(
    '<a href="https://f.test/s/1?preview=true&amp;lang=de">Start</a><a href="https://f.test/s/1?preview=true">Go</a>'
  );
  mocks.sendEmbedSurveyPreviewEmail.mockResolvedValue(true);
});

describe("POST /api/internal/surveys/{surveyId}/preview-emails", () => {
  test("emails the caller the embed, attributed to them, the survey and its organization", async () => {
    const response = await send();

    expect(response.status).toBe(202);
    expect((await response.json()).data).toEqual({ emailSent: true });
    expect(mocks.can).toHaveBeenCalledWith(actor, "survey.read", { type: "survey", id: SURVEY_ID });
    expect(mocks.getEmailTemplateHtml).toHaveBeenCalledWith(SURVEY_ID, "de-DE");
    expect(mocks.sendEmbedSurveyPreviewEmail).toHaveBeenCalledWith({
      to: "test@example.com",
      innerHtml: '<a href="https://f.test/s/1?lang=de">Start</a><a href="https://f.test/s/1">Go</a>',
      workspaceId: WORKSPACE_ID,
      locale: "de-DE",
      actorUserId: USER_ID,
      logoUrl: "https://example.com/logo.png",
      surveyId: SURVEY_ID,
      organizationId: ORG_ID,
    });
  });

  test("sends without a logo when the organization has none", async () => {
    mocks.getOrganizationLogoUrl.mockResolvedValue(null);
    await send();
    expect(mocks.sendEmbedSurveyPreviewEmail).toHaveBeenCalledWith(expect.objectContaining({ logoUrl: "" }));
  });

  test("says when no email went out, on an instance without SMTP", async () => {
    mocks.sendEmbedSurveyPreviewEmail.mockResolvedValue(false);
    expect((await (await send()).json()).data).toEqual({ emailSent: false });
  });

  // ENG-3282: authorized first, so a forbidden survey and a missing one answer alike.
  test("answers the uniform 403 to a caller who can't read the survey, before reading anything", async () => {
    mocks.can.mockResolvedValue(false);

    const response = await send();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.getOrganizationIdFromSurveyId).not.toHaveBeenCalled();
    expect(mocks.sendEmbedSurveyPreviewEmail).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a survey deleted since the check", async () => {
    mocks.getOrganizationIdFromSurveyId.mockRejectedValue(new ResourceNotFoundError("Survey", SURVEY_ID));
    expect((await send()).status).toBe(403);
    expect(mocks.sendEmbedSurveyPreviewEmail).not.toHaveBeenCalled();
  });

  test("answers 429 with the limiter's message once the sender's email budget is spent", async () => {
    mocks.sendEmbedSurveyPreviewEmail.mockRejectedValue(
      new TooManyRequestsError("Too many emails sent. Please try again later.", 60)
    );

    const response = await send();

    expect(response.status).toBe(429);
    expect((await response.json()).detail).toBe("Too many emails sent. Please try again later.");
  });

  test("answers 502 with the reason when the SMTP server refuses the message", async () => {
    mocks.sendEmbedSurveyPreviewEmail.mockRejectedValue(new InvalidInputError("Incorrect SMTP credentials"));

    const response = await send();

    expect(response.status).toBe(502);
    expect((await response.json()).detail).toBe("Incorrect SMTP credentials");
  });

  test("refuses a cross-site request", async () => {
    expect((await send({ headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.sendEmbedSurveyPreviewEmail).not.toHaveBeenCalled();
  });
});
