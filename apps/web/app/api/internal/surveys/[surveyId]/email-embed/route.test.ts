import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  getUser: vi.fn(),
  getEmailTemplateHtml: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/user/service", () => ({ getUser: mocks.getUser }));
vi.mock(
  "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/emailTemplate",
  () => ({ getEmailTemplateHtml: mocks.getEmailTemplateHtml })
);
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
const SURVEY_ID = "clsurvey11111111111111111";
const HTML = '<p>Survey</p><a href="https://f.test/s/1?preview=true">Start</a>';

const read = () =>
  GET(new NextRequest(`http://localhost/api/internal/surveys/${SURVEY_ID}/email-embed`), {
    params: Promise.resolve({ surveyId: SURVEY_ID }),
  } as never);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.getUser.mockResolvedValue({ id: USER_ID, locale: "fr-FR" });
  mocks.getEmailTemplateHtml.mockResolvedValue(HTML);
});

describe("GET /api/internal/surveys/{surveyId}/email-embed", () => {
  test("renders the survey as an email in the caller's locale for a survey editor, unchanged", async () => {
    const response = await read();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");
    expect((await response.json()).data).toEqual({ surveyId: SURVEY_ID, html: HTML });
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "survey.write", {
      type: "survey",
      id: SURVEY_ID,
    });
    expect(mocks.getEmailTemplateHtml).toHaveBeenCalledWith(SURVEY_ID, "fr-FR");
  });

  test("answers the uniform 403 to a caller who can't edit the survey, rendering nothing", async () => {
    mocks.can.mockResolvedValue(false);

    const response = await read();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.getEmailTemplateHtml).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a survey deleted since the check", async () => {
    mocks.getEmailTemplateHtml.mockRejectedValue(new ResourceNotFoundError("Survey", SURVEY_ID));
    expect((await read()).status).toBe(403);
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await read()).status).toBe(401);
  });
});
