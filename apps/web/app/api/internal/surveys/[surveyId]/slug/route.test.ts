import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError, ResourceNotFoundError, TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { DELETE, PUT } from "./route";
import { SURVEY_SLUG_MAX_LENGTH } from "./schemas";

const mocks = vi.hoisted(() => ({
  constants: { IS_FORMBRICKS_CLOUD: false },
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
  updateSurveySlug: vi.fn(),
}));

vi.mock("@/lib/constants", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/constants")>();
  return {
    ...actual,
    get IS_FORMBRICKS_CLOUD() {
      return mocks.constants.IS_FORMBRICKS_CLOUD;
    },
  };
});
vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/utils/helper", () => ({ getWorkspaceIdFromSurveyId: mocks.getWorkspaceIdFromSurveyId }));
vi.mock("@/modules/survey/lib/slug", () => ({ updateSurveySlug: mocks.updateSurveySlug }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const SURVEY_ID = "clsurvey11111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";

const url = (id = SURVEY_ID) => `http://localhost/api/internal/surveys/${id}/slug`;
const props = (id = SURVEY_ID) => ({ params: Promise.resolve({ surveyId: id }) });

const put = (
  body: unknown,
  { id = SURVEY_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}
) =>
  PUT(
    new NextRequest(url(id), {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
    }),
    props(id) as never
  );

const remove = ({ id = SURVEY_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}) =>
  DELETE(new NextRequest(url(id), { method: "DELETE", headers }), props(id) as never);

const operationLimits = () =>
  mocks.applyRateLimit.mock.calls
    .filter(([config]) => config.namespace !== rateLimitConfigs.api.v3.namespace)
    .map(([config, identifier]) => [config.namespace, identifier]);

const SAVED_AT = new Date("2026-11-12T10:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mocks.constants.IS_FORMBRICKS_CLOUD = false;
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getWorkspaceIdFromSurveyId.mockResolvedValue(WORKSPACE_ID);
  mocks.updateSurveySlug.mockImplementation(async (id: string, slug: string | null) => ({
    id,
    slug,
    updatedAt: SAVED_AT,
  }));
});

describe("PUT /api/internal/surveys/{surveyId}/slug", () => {
  test("sets the slug for a survey editor, charged to the survey's workspace", async () => {
    const response = await put({ slug: "summer-feedback" });

    expect(response.status).toBe(200);
    // The survey's `updatedAt` after the write, so the page can hold the slug over an older render.
    expect((await response.json()).data).toEqual({
      surveyId: SURVEY_ID,
      slug: "summer-feedback",
      updatedAt: SAVED_AT.toISOString(),
    });
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "survey.write", {
      type: "survey",
      id: SURVEY_ID,
    });
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, WORKSPACE_ID]]);
    expect(mocks.updateSurveySlug).toHaveBeenCalledWith(SURVEY_ID, "summer-feedback");
    // Not audited, as the server action wasn't.
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("refuses on Formbricks Cloud with its reason, before anything else", async () => {
    mocks.constants.IS_FORMBRICKS_CLOUD = true;

    const response = await put({ slug: "summer-feedback" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Pretty URLs are only available on self-hosted instances");
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.updateSurveySlug).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 to a caller who can't edit the survey, or for one that doesn't exist", async () => {
    mocks.can.mockResolvedValue(false);

    const response = await put({ slug: "summer-feedback" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(operationLimits()).toEqual([]);
    expect(mocks.updateSurveySlug).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a survey deleted after the check", async () => {
    mocks.getWorkspaceIdFromSurveyId.mockRejectedValue(new ResourceNotFoundError("survey", SURVEY_ID));
    expect((await put({ slug: "summer-feedback" })).status).toBe(403);
    expect(mocks.updateSurveySlug).not.toHaveBeenCalled();
  });

  test("answers 409 with the reason when another survey has the slug", async () => {
    mocks.updateSurveySlug.mockRejectedValue(new InvalidInputError("A survey with this slug already exists"));

    const response = await put({ slug: "taken" });

    expect(response.status).toBe(409);
    expect((await response.json()).detail).toBe("A survey with this slug already exists");
  });

  test("answers 429 once the workspace's settings-write budget is spent, and changes nothing", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.stateMutation.namespace) {
        throw new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60);
      }
    });

    expect((await put({ slug: "summer-feedback" })).status).toBe(429);
    expect(mocks.updateSurveySlug).not.toHaveBeenCalled();
  });

  test("answers 400 with the slug rule the form shows", async () => {
    const response = await put({ slug: "Summer Feedback" });

    expect(response.status).toBe(400);
    expect((await response.json()).invalid_params).toEqual([
      expect.objectContaining({
        name: "slug",
        reason: "Slug can only contain lowercase letters, numbers, and hyphens",
      }),
    ]);
    expect(mocks.updateSurveySlug).not.toHaveBeenCalled();
  });

  test.each([
    ["no slug", {}],
    ["an unknown key", { slug: "summer", name: "x" }],
    ["a slug past the cap", { slug: "a".repeat(SURVEY_SLUG_MAX_LENGTH + 1) }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await put(body)).status).toBe(400);
    expect(mocks.updateSurveySlug).not.toHaveBeenCalled();
  });

  test("answers 400 for a malformed survey id", async () => {
    expect((await put({ slug: "summer" }, { id: "not a cuid" })).status).toBe(400);
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await put({ slug: "summer" })).status).toBe(401);
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await put({ slug: "summer" }, { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.updateSurveySlug).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal/surveys/{surveyId}/slug", () => {
  test("clears the slug with the same checks", async () => {
    const response = await remove();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({
      surveyId: SURVEY_ID,
      slug: null,
      updatedAt: SAVED_AT.toISOString(),
    });
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "survey.write", {
      type: "survey",
      id: SURVEY_ID,
    });
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, WORKSPACE_ID]]);
    expect(mocks.updateSurveySlug).toHaveBeenCalledWith(SURVEY_ID, null);
  });

  test("refuses on Formbricks Cloud", async () => {
    mocks.constants.IS_FORMBRICKS_CLOUD = true;
    expect((await remove()).status).toBe(403);
    expect(mocks.updateSurveySlug).not.toHaveBeenCalled();
  });

  test("refuses a caller who can't edit the survey", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await remove()).status).toBe(403);
    expect(mocks.updateSurveySlug).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await remove({ headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.updateSurveySlug).not.toHaveBeenCalled();
  });
});
