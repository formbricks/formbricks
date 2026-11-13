import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { QuotaNameTakenError } from "@/modules/ee/quotas/lib/errors";
import { GET } from "./[quotaId]/response-count/route";
import { DELETE, PUT } from "./[quotaId]/route";
import { POST } from "./route";
import { QUOTA_LIMIT_MAX, QUOTA_NAME_MAX_LENGTH, QUOTA_OPERAND_META_MAX_ENTRIES } from "./schemas";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  queueAuditEvent: vi.fn(),
  getOrganizationIdFromSurveyId: vi.fn(),
  getOrganizationBilling: vi.fn(),
  getIsQuotasEnabled: vi.fn(),
  getQuota: vi.fn(),
  createQuota: vi.fn(),
  updateQuota: vi.fn(),
  deleteQuota: vi.fn(),
  getQuotaLinkCountByQuotaId: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromSurveyId: mocks.getOrganizationIdFromSurveyId }));
vi.mock("@/modules/survey/lib/survey", () => ({ getOrganizationBilling: mocks.getOrganizationBilling }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsQuotasEnabled: mocks.getIsQuotasEnabled }));
vi.mock("@/modules/ee/quotas/lib/quotas", () => ({
  getQuota: mocks.getQuota,
  createQuota: mocks.createQuota,
  updateQuota: mocks.updateQuota,
  deleteQuota: mocks.deleteQuota,
}));
vi.mock("@/modules/ee/quotas/lib/quota-link", () => ({
  getQuotaLinkCountByQuotaId: mocks.getQuotaLinkCountByQuotaId,
}));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({
  applyRateLimit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: mocks.queueAuditEvent }));
vi.mock("@/app/lib/api/with-api-logging", () => ({
  buildAuditLogBaseObject: vi.fn((action: string, targetType: string) => ({
    action,
    targetType,
    status: "failure",
  })),
}));
vi.mock("@formbricks/logger", () => ({
  logger: { withContext: vi.fn(() => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() })), error: vi.fn() },
}));
vi.mock("server-only", () => ({}));

const USER_ID = "cluser1111111111111111111";
const ORG_ID = "clorg11111111111111111111";
const SURVEY_ID = "clsurvey11111111111111111";
const QUOTA_ID = "clquota111111111111111111";
const CONDITION_ID = "clcond1111111111111111111";
const ENDING_ID = "clending11111111111111111";
const actor = { type: "user", id: USER_ID };

const quotaBody = (overrides: Record<string, unknown> = {}) => ({
  surveyId: SURVEY_ID,
  name: "Under 30",
  limit: 50,
  logic: {
    connector: "and",
    conditions: [
      {
        id: CONDITION_ID,
        leftOperand: { type: "element", value: "age" },
        operator: "isLessThan",
        rightOperand: { type: "static", value: 30 },
      },
    ],
  },
  action: "endSurvey",
  endingCardId: ENDING_ID,
  countPartialSubmissions: false,
  ...overrides,
});

const storedQuota = (overrides: Record<string, unknown> = {}) => ({
  id: QUOTA_ID,
  createdAt: new Date("2026-10-01T10:00:00.000Z"),
  updatedAt: new Date("2026-10-01T10:00:00.000Z"),
  ...quotaBody(),
  ...overrides,
});

const send = (
  method: "POST" | "PUT",
  body: unknown,
  { id = QUOTA_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}
) => {
  const path = method === "POST" ? "" : `/${id}`;
  const request = new NextRequest(`http://localhost/api/internal/quotas${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
  return method === "POST"
    ? POST(request, {} as never)
    : PUT(request, { params: Promise.resolve({ quotaId: id }) } as never);
};

const create = (body: unknown, options?: { headers?: Record<string, string> }) => send("POST", body, options);
const update = (body: unknown, options?: { id?: string; headers?: Record<string, string> }) =>
  send("PUT", body, options);

const remove = ({ id = QUOTA_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}) =>
  DELETE(new NextRequest(`http://localhost/api/internal/quotas/${id}`, { method: "DELETE", headers }), {
    params: Promise.resolve({ quotaId: id }),
  } as never);

const responseCount = ({ id = QUOTA_ID } = {}) =>
  GET(new NextRequest(`http://localhost/api/internal/quotas/${id}/response-count`), {
    params: Promise.resolve({ quotaId: id }),
  } as never);

const checkedActions = () => mocks.can.mock.calls.map(([, action, resource]) => [action, resource]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.getOrganizationIdFromSurveyId.mockResolvedValue(ORG_ID);
  mocks.getOrganizationBilling.mockResolvedValue({ plan: "custom" });
  mocks.getIsQuotasEnabled.mockResolvedValue(true);
  mocks.getQuota.mockResolvedValue(storedQuota());
  mocks.createQuota.mockImplementation(async (input: Record<string, unknown>) => storedQuota(input));
  mocks.updateQuota.mockImplementation(async (input: Record<string, unknown>) => storedQuota(input));
  mocks.deleteQuota.mockResolvedValue(storedQuota());
  mocks.getQuotaLinkCountByQuotaId.mockResolvedValue(7);
});

describe("POST /api/internal/quotas", () => {
  test("creates a quota for a survey editor where quotas are licensed, and audits it", async () => {
    const response = await create(quotaBody());

    expect(response.status).toBe(201);
    const { data } = await response.json();
    expect(data).toEqual({ id: QUOTA_ID, ...quotaBody() });
    expect(checkedActions()).toEqual([["survey.write", { type: "survey", id: SURVEY_ID }]]);
    expect(mocks.can).toHaveBeenCalledWith(actor, "survey.write", { type: "survey", id: SURVEY_ID });
    expect(mocks.getIsQuotasEnabled).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.createQuota).toHaveBeenCalledWith(quotaBody());
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "created",
        targetType: "quota",
        status: "success",
        organizationId: ORG_ID,
        targetId: QUOTA_ID,
        newObject: expect.objectContaining({ id: QUOTA_ID, name: "Under 30" }),
      })
    );
  });

  test("answers the uniform 403 to a caller who can't edit the survey, before the licence", async () => {
    mocks.can.mockResolvedValue(false);

    const response = await create(quotaBody());

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.getIsQuotasEnabled).not.toHaveBeenCalled();
    expect(mocks.createQuota).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "created", status: "failure", organizationId: ORG_ID })
    );
  });

  test("answers the uniform 403 for a survey that doesn't exist", async () => {
    mocks.getOrganizationIdFromSurveyId.mockRejectedValue(new ResourceNotFoundError("survey", SURVEY_ID));
    expect((await create(quotaBody())).status).toBe(403);
    expect(mocks.createQuota).not.toHaveBeenCalled();
  });

  test("refuses where quotas aren't licensed, with the reason", async () => {
    mocks.getIsQuotasEnabled.mockResolvedValue(false);

    const response = await create(quotaBody());

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Quotas are not enabled");
    expect(mocks.createQuota).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for an organization without billing", async () => {
    mocks.getOrganizationBilling.mockRejectedValue(new ResourceNotFoundError("Organization", ORG_ID));
    const response = await create(quotaBody());
    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
  });

  test("answers 409 with the reason for a name another quota on the survey has", async () => {
    mocks.createQuota.mockRejectedValue(new QuotaNameTakenError());

    const response = await create(quotaBody());

    expect(response.status).toBe(409);
    expect((await response.json()).detail).toBe("Quota with this name already exists");
  });

  test("answers 422 with the reason for a condition on a matrix id the survey doesn't have", async () => {
    mocks.createQuota.mockRejectedValue(new InvalidInputError("Unknown matrix row (logic.conditions.0)"));

    const response = await create(quotaBody());

    expect(response.status).toBe(422);
    expect((await response.json()).detail).toBe("Unknown matrix row (logic.conditions.0)");
  });

  test("answers 400 with the shared rule when an ending survey quota names no ending", async () => {
    const response = await create(quotaBody({ endingCardId: null }));

    expect(response.status).toBe(400);
    expect((await response.json()).invalid_params).toEqual([
      expect.objectContaining({ reason: "endingCardId is required when action is endSurvey" }),
    ]);
    expect(mocks.createQuota).not.toHaveBeenCalled();
  });

  test.each([
    ["an empty name", quotaBody({ name: "" })],
    ["a name past the cap", quotaBody({ name: "a".repeat(QUOTA_NAME_MAX_LENGTH + 1) })],
    ["a limit below 1", quotaBody({ limit: 0 })],
    ["an unknown key", { ...quotaBody(), priority: 1 }],
    ["an unknown key in the logic", quotaBody({ logic: { ...quotaBody().logic, extra: true } })],
    [
      "an unknown key in a condition",
      quotaBody({
        logic: { connector: "and", conditions: [{ ...quotaBody().logic.conditions[0], note: "x" }] },
      }),
    ],
    ["an unknown action", quotaBody({ action: "pauseSurvey" })],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await create(body)).status).toBe(400);
    expect(mocks.createQuota).not.toHaveBeenCalled();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await create(quotaBody())).status).toBe(401);
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await create(quotaBody(), { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.createQuota).not.toHaveBeenCalled();
  });
});

describe("PUT /api/internal/quotas/{quotaId}", () => {
  test("updates the quota on its own survey, and audits the body and the saved quota", async () => {
    const body = quotaBody({ name: "Under 25", limit: 40 });

    const response = await update(body);

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(expect.objectContaining({ id: QUOTA_ID, name: "Under 25" }));
    expect(checkedActions()).toEqual([["survey.write", { type: "survey", id: SURVEY_ID }]]);
    expect(mocks.getOrganizationIdFromSurveyId).toHaveBeenCalledWith(SURVEY_ID);
    expect(mocks.updateQuota).toHaveBeenCalledWith(body, QUOTA_ID);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "updated",
        targetType: "quota",
        status: "success",
        organizationId: ORG_ID,
        targetId: QUOTA_ID,
        oldObject: body,
        newObject: expect.objectContaining({ id: QUOTA_ID, name: "Under 25" }),
      })
    );
  });

  test("authorizes against the quota's survey, not the survey the body names", async () => {
    const OTHER_SURVEY_ID = "clsurvey22222222222222222";
    mocks.can.mockImplementation(
      async (_actor: unknown, _action: string, resource: { id: string }) => resource.id === OTHER_SURVEY_ID
    );

    const response = await update(quotaBody({ surveyId: OTHER_SURVEY_ID }));

    expect(response.status).toBe(403);
    expect(checkedActions()).toEqual([["survey.write", { type: "survey", id: SURVEY_ID }]]);
    expect(mocks.updateQuota).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a quota that doesn't exist, and audits it against the id", async () => {
    mocks.getQuota.mockRejectedValue(new ResourceNotFoundError("Quota", QUOTA_ID));

    const response = await update(quotaBody());

    expect(response.status).toBe(403);
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.updateQuota).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "updated", status: "failure", targetId: QUOTA_ID })
    );
  });

  test("refuses where quotas aren't licensed", async () => {
    mocks.getIsQuotasEnabled.mockResolvedValue(false);
    const response = await update(quotaBody());
    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Quotas are not enabled");
    expect(mocks.updateQuota).not.toHaveBeenCalled();
  });

  test("answers 409 for a taken name", async () => {
    mocks.updateQuota.mockRejectedValue(new QuotaNameTakenError());
    expect((await update(quotaBody())).status).toBe(409);
  });

  test("answers the uniform 403 for a quota deleted meanwhile", async () => {
    mocks.updateQuota.mockRejectedValue(new ResourceNotFoundError("Quota", QUOTA_ID));
    expect((await update(quotaBody())).status).toBe(403);
  });

  test("answers 400 for a malformed quota id", async () => {
    expect((await update(quotaBody(), { id: "not a cuid" })).status).toBe(400);
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await update(quotaBody(), { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.updateQuota).not.toHaveBeenCalled();
  });
});

describe("quota input limits", () => {
  const text = (length: number) => "a".repeat(length);
  const withCondition = (overrides: Record<string, unknown>) =>
    quotaBody({
      logic: { connector: "and", conditions: [{ ...quotaBody().logic.conditions[0], ...overrides }] },
    });
  const meta = (entries: number, length = 1) =>
    Object.fromEntries(Array.from({ length: entries }, (_, i) => [`row${i}`, text(length)]));
  const CONDITION = "logic.conditions.0";

  test.each([
    ["limit", 1, 0, (n: number) => quotaBody({ limit: n })],
    ["limit", QUOTA_LIMIT_MAX, QUOTA_LIMIT_MAX + 1, (n: number) => quotaBody({ limit: n })],
    ["limit", 2, 2.5, (n: number) => quotaBody({ limit: n })],
    [
      `${CONDITION}.leftOperand.value`,
      255,
      256,
      (n: number) => withCondition({ leftOperand: { type: "element", value: text(n) } }),
    ],
    [
      `${CONDITION}.leftOperand.meta`,
      QUOTA_OPERAND_META_MAX_ENTRIES,
      QUOTA_OPERAND_META_MAX_ENTRIES + 1,
      (n: number) => withCondition({ leftOperand: { type: "element", value: "grid", meta: meta(n) } }),
    ],
    [
      `${CONDITION}.leftOperand.meta.row0`,
      255,
      256,
      (n: number) => withCondition({ leftOperand: { type: "element", value: "grid", meta: meta(1, n) } }),
    ],
    [
      `${CONDITION}.rightOperand.value`,
      5000,
      5001,
      (n: number) => withCondition({ operator: "equals", rightOperand: { type: "static", value: text(n) } }),
    ],
    [
      `${CONDITION}.rightOperand.value.1`,
      5000,
      5001,
      (n: number) =>
        withCondition({ operator: "equalsOneOf", rightOperand: { type: "static", value: ["a", text(n)] } }),
    ],
    [
      `${CONDITION}.rightOperand.columnId`,
      255,
      256,
      (n: number) =>
        withCondition({ operator: "equals", rightOperand: { type: "static", value: 1, columnId: text(n) } }),
    ],
    [
      `${CONDITION}.rightOperand.value`,
      255,
      256,
      (n: number) =>
        withCondition({ operator: "equals", rightOperand: { type: "hiddenField", value: text(n) } }),
    ],
  ])("takes %s at %d and answers 400 naming it at %d", async (field, accepted, refused, build) => {
    expect((await create(build(accepted))).status).toBe(201);
    expect((await update(build(accepted))).status).toBe(200);

    mocks.createQuota.mockClear();
    mocks.updateQuota.mockClear();
    for (const write of [create, update]) {
      const response = await write(build(refused));
      expect(response.status).toBe(400);
      expect((await response.json()).invalid_params).toEqual([expect.objectContaining({ name: field })]);
    }
    expect(mocks.createQuota).not.toHaveBeenCalled();
    expect(mocks.updateQuota).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal/quotas/{quotaId}", () => {
  test("deletes the quota, and audits the deleted quota", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(checkedActions()).toEqual([["survey.write", { type: "survey", id: SURVEY_ID }]]);
    expect(mocks.deleteQuota).toHaveBeenCalledWith(QUOTA_ID);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        targetType: "quota",
        status: "success",
        organizationId: ORG_ID,
        targetId: QUOTA_ID,
        oldObject: expect.objectContaining({ id: QUOTA_ID }),
      })
    );
  });

  test("answers the uniform 403 to a caller who can't edit the survey", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await remove()).status).toBe(403);
    expect(mocks.deleteQuota).not.toHaveBeenCalled();
  });

  test("refuses where quotas aren't licensed", async () => {
    mocks.getIsQuotasEnabled.mockResolvedValue(false);
    expect((await remove()).status).toBe(403);
    expect(mocks.deleteQuota).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a quota deleted meanwhile", async () => {
    mocks.deleteQuota.mockRejectedValue(new ResourceNotFoundError("Quota", QUOTA_ID));
    expect((await remove()).status).toBe(403);
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await remove({ headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.deleteQuota).not.toHaveBeenCalled();
  });
});

describe("GET /api/internal/quotas/{quotaId}/response-count", () => {
  test("answers the screened-in count to a caller who may read the survey's responses", async () => {
    const response = await responseCount();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ quotaId: QUOTA_ID, count: 7 });
    expect(checkedActions()).toEqual([["survey.response_read", { type: "survey", id: SURVEY_ID }]]);
    expect(mocks.getIsQuotasEnabled).toHaveBeenCalledWith(ORG_ID);
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 to a caller who can't read the survey's responses", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await responseCount()).status).toBe(403);
    expect(mocks.getQuotaLinkCountByQuotaId).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a quota that doesn't exist", async () => {
    mocks.getQuota.mockRejectedValue(new ResourceNotFoundError("Quota", QUOTA_ID));
    expect((await responseCount()).status).toBe(403);
  });

  test("refuses where quotas aren't licensed", async () => {
    mocks.getIsQuotasEnabled.mockResolvedValue(false);
    const response = await responseCount();
    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("Quotas are not enabled");
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await responseCount()).status).toBe(401);
  });
});
