import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { AuthorizationError, DatabaseError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { GET } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  assertCan: vi.fn(),
  getSession: vi.fn(),
  resolveWorkspace: vi.fn(),
  getSurvey: vi.fn(),
  getResponseFilteringValues: vi.fn(),
  getTagsByWorkspaceId: vi.fn(),
  getIsQuotasEnabled: vi.fn(),
  getQuotas: vi.fn(),
  getOrganizationBilling: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can, assertCan: mocks.assertCan }));
vi.mock("@/app/api/v3/lib/workspace-context", () => ({ resolveV3WorkspaceContext: mocks.resolveWorkspace }));
vi.mock("@/lib/survey/service", () => ({ getSurvey: mocks.getSurvey }));
vi.mock("@/lib/response/service", () => ({ getResponseFilteringValues: mocks.getResponseFilteringValues }));
vi.mock("@/lib/tag/service", () => ({ getTagsByWorkspaceId: mocks.getTagsByWorkspaceId }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsQuotasEnabled: mocks.getIsQuotasEnabled }));
vi.mock("@/modules/ee/quotas/lib/quotas", () => ({ getQuotas: mocks.getQuotas }));
vi.mock("@/modules/survey/lib/survey", () => ({ getOrganizationBilling: mocks.getOrganizationBilling }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";
const SURVEY_ID = "clsrv11111111111111111111";
const OTHER_SURVEY_ID = "clsrv22222222222222222222";
const CREATED_AT = new Date("2026-10-01T10:00:00.000Z");

const TAG = { id: "cltag1111111111111111111", name: "vip", workspaceId: WORKSPACE_ID, createdAt: CREATED_AT };
const QUOTA = {
  id: "clquota11111111111111111",
  name: "Germany",
  surveyId: SURVEY_ID,
  limit: 100,
  logic: { connector: "and", conditions: [] },
  action: "endSurvey",
  endingCardId: null,
  countPartialSubmissions: false,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
};
const VALUES = {
  contactAttributes: { plan: ["Pro", "Free"] },
  meta: { source: ["web"] },
  hiddenFields: { ref: ["newsletter"] },
  reservedValues: { utmSource: ["google"] },
  variableValues: { score: ["3"] },
};

const actor = { type: "user", id: USER_ID };
const withoutRequestId = async (response: Response) => {
  const { requestId: _requestId, ...rest } = await response.json();
  return rest;
};

const getOptions = (query: string = `surveyId=${SURVEY_ID}`) =>
  GET(
    new NextRequest(`http://localhost/api/internal/response-filter-options?${query}`, {
      headers: SAME_ORIGIN_HEADERS,
    }),
    { params: Promise.resolve({}) } as never
  );

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.resolveWorkspace.mockImplementation(async (workspaceId: string) => ({
    workspaceId,
    organizationId: ORG_ID,
  }));
  mocks.getSurvey.mockResolvedValue({ id: SURVEY_ID, workspaceId: WORKSPACE_ID });
  mocks.getOrganizationBilling.mockResolvedValue({ plan: "free" });
  mocks.getIsQuotasEnabled.mockResolvedValue(true);
  mocks.getTagsByWorkspaceId.mockResolvedValue([TAG]);
  mocks.getResponseFilteringValues.mockResolvedValue(VALUES);
  mocks.getQuotas.mockResolvedValue([QUOTA]);
  mocks.applyRateLimit.mockResolvedValue(undefined);
});

describe("GET /api/internal/response-filter-options", () => {
  test("returns what the filter builds its properties from, and nothing else", async () => {
    const response = await getOptions();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    // Tags and quotas narrowed to what the filter shows; `meta` was never read by the filter.
    expect((await response.json()).data).toEqual({
      tags: [{ id: TAG.id, name: "vip" }],
      attributes: VALUES.contactAttributes,
      hiddenFields: VALUES.hiddenFields,
      reservedValues: VALUES.reservedValues,
      variableValues: VALUES.variableValues,
      quotas: [{ id: QUOTA.id, name: "Germany" }],
    });
    expect(mocks.getTagsByWorkspaceId).toHaveBeenCalledWith(WORKSPACE_ID);
    expect(mocks.getResponseFilteringValues).toHaveBeenCalledWith(SURVEY_ID);
    expect(mocks.getQuotas).toHaveBeenCalledWith(SURVEY_ID);
  });

  test("offers no quotas when the organization isn't entitled to them", async () => {
    mocks.getIsQuotasEnabled.mockResolvedValue(false);

    const { data } = await (await getOptions()).json();

    expect(data.quotas).toEqual([]);
    expect(mocks.getIsQuotasEnabled).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.getQuotas).not.toHaveBeenCalled();
  });

  test("asks for survey.response_read on the survey, then read on its workspace", async () => {
    await getOptions();

    expect(mocks.can).toHaveBeenCalledWith(actor, "survey.response_read", { type: "survey", id: SURVEY_ID });
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "workspace.read", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
  });

  test("spends the default API budget and writes no audit entry: it is a read", async () => {
    await getOptions();

    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.api.v3, USER_ID);
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("refuses an unauthenticated caller with 401", async () => {
    mocks.getSession.mockResolvedValue(null);

    expect((await getOptions()).status).toBe(401);
    expect(mocks.getResponseFilteringValues).not.toHaveBeenCalled();
  });

  test("refuses a caller without survey.response_read with 403 and reads nothing", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await getOptions()).status).toBe(403);
    expect(mocks.getSurvey).not.toHaveBeenCalled();
    expect(mocks.getResponseFilteringValues).not.toHaveBeenCalled();
    expect(mocks.getTagsByWorkspaceId).not.toHaveBeenCalled();
  });

  test("refuses a caller who can't read the survey's workspace with 403", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));

    expect((await getOptions()).status).toBe(403);
    expect(mocks.getResponseFilteringValues).not.toHaveBeenCalled();
    expect(mocks.getTagsByWorkspaceId).not.toHaveBeenCalled();
  });

  test("answers another tenant's survey and a missing one with the same 403", async () => {
    mocks.can.mockResolvedValue(false);
    const otherTenant = await getOptions(`surveyId=${OTHER_SURVEY_ID}`);

    mocks.can.mockResolvedValue(true);
    mocks.getSurvey.mockResolvedValue(null);
    const missing = await getOptions(`surveyId=${OTHER_SURVEY_ID}`);

    expect(otherTenant.status).toBe(403);
    expect(missing.status).toBe(403);
    expect(await withoutRequestId(otherTenant)).toEqual(await withoutRequestId(missing));
    expect(mocks.getResponseFilteringValues).not.toHaveBeenCalled();
  });

  test("an organization without billing answers 403, as the action refused it", async () => {
    mocks.getOrganizationBilling.mockResolvedValue(null);

    expect((await getOptions()).status).toBe(403);
    expect(mocks.getResponseFilteringValues).not.toHaveBeenCalled();
  });

  test.each([
    ["a missing surveyId", ""],
    ["a surveyId that is not an id", "surveyId=not-an-id"],
    ["an unknown query parameter", `surveyId=${SURVEY_ID}&workspaceId=${WORKSPACE_ID}`],
  ])("rejects %s with 400", async (_name, query) => {
    expect((await getOptions(query)).status).toBe(400);
    expect(mocks.can).not.toHaveBeenCalled();
  });

  test("a failed read is mapped, not leaked", async () => {
    mocks.getResponseFilteringValues.mockRejectedValue(new DatabaseError("connection reset"));

    const response = await getOptions();

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain("connection reset");
  });
});
