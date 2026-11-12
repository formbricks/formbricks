import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError, ValidationError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { PUT } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  getSurvey: vi.fn(),
  updateSurvey: vi.fn(),
  logError: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: mocks.getSurvey, updateSurvey: mocks.updateSurvey }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@formbricks/logger", () => ({
  logger: {
    withContext: vi.fn(() => ({ error: mocks.logError, warn: vi.fn(), info: vi.fn() })),
    error: vi.fn(),
  },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const SURVEY_ID = "clsurvey11111111111111111";
const survey = { id: SURVEY_ID, name: "NPS", singleUse: { enabled: false, isEncrypted: false } };

const put = (body: unknown = { enabled: true, isEncrypted: true }) =>
  PUT(
    new NextRequest(`http://localhost/api/internal/surveys/${SURVEY_ID}/single-use-settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...SAME_ORIGIN_HEADERS },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ surveyId: SURVEY_ID }) } as never
  );

const SAVED_AT = new Date("2026-11-12T10:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.getSurvey.mockResolvedValue(survey);
  mocks.updateSurvey.mockImplementation(async (input: typeof survey) => ({ ...input, updatedAt: SAVED_AT }));
});

describe("PUT /api/internal/surveys/{surveyId}/single-use-settings", () => {
  test("saves the survey with its new single-use settings for a survey editor", async () => {
    const response = await put();

    expect(response.status).toBe(200);
    // The survey's `updatedAt` after the write, so the page can hold these settings over an older render.
    expect((await response.json()).data).toEqual({
      surveyId: SURVEY_ID,
      enabled: true,
      isEncrypted: true,
      updatedAt: SAVED_AT.toISOString(),
    });
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "survey.write", {
      type: "survey",
      id: SURVEY_ID,
    });
    expect(mocks.updateSurvey).toHaveBeenCalledWith({
      ...survey,
      singleUse: { enabled: true, isEncrypted: true },
    });
  });

  test("answers the uniform 403 to a caller who can't edit the survey, saving nothing", async () => {
    mocks.can.mockResolvedValue(false);

    const response = await put();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.getSurvey).not.toHaveBeenCalled();
    expect(mocks.updateSurvey).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a survey gone since the check", async () => {
    mocks.getSurvey.mockResolvedValue(null);
    expect((await put()).status).toBe(403);
    expect(mocks.updateSurvey).not.toHaveBeenCalled();
  });

  test("answers 422 with the reason the update refuses the survey for", async () => {
    mocks.updateSurvey.mockRejectedValue(
      new InvalidInputError("This survey is archived. Restore it before editing.")
    );

    const response = await put();

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe("This survey is archived. Restore it before editing.");
  });

  test("answers 500 and logs at error when the update rejects the stored survey as invalid", async () => {
    mocks.updateSurvey.mockRejectedValue(new ValidationError("Survey must have at least one block"));

    const response = await put();
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain("at least one block");
    expect(mocks.logError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(ValidationError), statusCode: 500 }),
      "V3 unexpected error"
    );
  });

  test.each([
    ["a missing flag", { enabled: true }],
    ["a flag that isn't a boolean", { enabled: "true", isEncrypted: false }],
    ["an unknown key", { enabled: true, isEncrypted: false, workspaceId: "clwork1111111111111111111" }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await put(body)).status).toBe(400);
    expect(mocks.updateSurvey).not.toHaveBeenCalled();
  });
});
