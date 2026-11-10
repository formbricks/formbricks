import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { DatabaseError, ResourceNotFoundError, TooManyRequestsError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { DELETE as DELETE_RESPONSE, GET } from "./[responseId]/route";
import { DELETE as DELETE_TAG, PUT } from "./[responseId]/tags/[tagId]/route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  revalidatePath: vi.fn(),
  getResponse: vi.fn(),
  getResponseWithQuotas: vi.fn(),
  deleteResponse: vi.fn(),
  addTagToRespone: vi.fn(),
  deleteTagOnResponse: vi.fn(),
  getWorkspaceIdFromSurveyId: vi.fn(),
  getOrganizationIdFromWorkspaceId: vi.fn(),
  getTag: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can, assertCan: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/response/service", () => ({
  getResponse: mocks.getResponse,
  getResponseWithQuotas: mocks.getResponseWithQuotas,
  deleteResponse: mocks.deleteResponse,
}));
vi.mock("@/lib/tagOnResponse/service", () => ({
  addTagToRespone: mocks.addTagToRespone,
  deleteTagOnResponse: mocks.deleteTagOnResponse,
}));
vi.mock("@/lib/utils/helper", () => ({
  getWorkspaceIdFromSurveyId: mocks.getWorkspaceIdFromSurveyId,
  getOrganizationIdFromWorkspaceId: mocks.getOrganizationIdFromWorkspaceId,
}));
vi.mock("@/lib/utils/services", () => ({ getTag: mocks.getTag }));
vi.mock("@/modules/auth/lib/session", () => ({ getSession: mocks.getSession }));
vi.mock("@/app/api/v1/auth", () => ({ authenticateRequest: vi.fn() }));
vi.mock("@/modules/core/rate-limit/helpers", () => ({ applyRateLimit: mocks.applyRateLimit }));
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
const WORKSPACE_ID = "clwork1111111111111111111";
const OTHER_WORKSPACE_ID = "clwork2222222222222222222";
const SURVEY_ID = "clsurvey11111111111111111";
const RESPONSE_ID = "clresp1111111111111111111";
const TAG_ID = "cltag11111111111111111111";
const actor = { type: "user", id: USER_ID };
const CREATED_AT = new Date("2026-10-01T10:00:00.000Z");
const UPDATED_AT = new Date("2026-10-02T10:00:00.000Z");

const storedResponse = (overrides: Record<string, unknown> = {}) => ({
  id: RESPONSE_ID,
  createdAt: CREATED_AT,
  updatedAt: UPDATED_AT,
  surveyId: SURVEY_ID,
  displayId: null,
  contact: null,
  contactAttributes: null,
  finished: true,
  endingId: null,
  data: { q1: "Great" },
  variables: {},
  ttc: { q1: 1200 },
  tags: [
    { id: TAG_ID, name: "vip", workspaceId: WORKSPACE_ID, createdAt: CREATED_AT, updatedAt: UPDATED_AT },
  ],
  meta: { source: "link" },
  singleUseId: null,
  language: "default",
  outcome: null,
  ...overrides,
});

const responsePath = (id = RESPONSE_ID) => `http://localhost/api/internal/responses/${id}`;
const tagPath = (responseId = RESPONSE_ID, tagId = TAG_ID) => `${responsePath(responseId)}/tags/${tagId}`;

const read = (id = RESPONSE_ID, query = "") =>
  GET(new NextRequest(`${responsePath(id)}${query}`), {
    params: Promise.resolve({ responseId: id }),
  } as never);

const remove = ({
  id = RESPONSE_ID,
  query = "",
  headers = SAME_ORIGIN_HEADERS as Record<string, string>,
} = {}) =>
  DELETE_RESPONSE(new NextRequest(`${responsePath(id)}${query}`, { method: "DELETE", headers }), {
    params: Promise.resolve({ responseId: id }),
  } as never);

const tagRequest = (
  method: "PUT" | "DELETE",
  { responseId = RESPONSE_ID, tagId = TAG_ID, headers = SAME_ORIGIN_HEADERS as Record<string, string> } = {}
) => {
  const handler = method === "PUT" ? PUT : DELETE_TAG;
  return handler(new NextRequest(tagPath(responseId, tagId), { method, headers }), {
    params: Promise.resolve({ responseId, tagId }),
  } as never);
};

const checkedActions = () => mocks.can.mock.calls.map(([, action, resource]) => [action, resource]);

/** The rate limits charged, by namespace and identifier, after the wrapper's own per-user one. */
const operationLimits = () =>
  mocks.applyRateLimit.mock.calls
    .filter(([config]) => config.namespace !== rateLimitConfigs.api.v3.namespace)
    .map(([config, identifier]) => [config.namespace, identifier]);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.getResponse.mockResolvedValue(storedResponse());
  mocks.getResponseWithQuotas.mockResolvedValue({
    ...storedResponse(),
    quotas: [{ id: "clquota111111111111111111", name: "Under 30" }],
    notShown: null,
  });
  mocks.deleteResponse.mockResolvedValue(storedResponse());
  mocks.addTagToRespone.mockResolvedValue({ responseId: RESPONSE_ID, tagId: TAG_ID });
  mocks.deleteTagOnResponse.mockResolvedValue({ responseId: RESPONSE_ID, tagId: TAG_ID });
  mocks.getWorkspaceIdFromSurveyId.mockResolvedValue(WORKSPACE_ID);
  mocks.getOrganizationIdFromWorkspaceId.mockResolvedValue(ORG_ID);
  mocks.getTag.mockResolvedValue({ workspaceId: WORKSPACE_ID });
});

describe("GET /api/internal/responses/{responseId}", () => {
  test("answers the response with its quotas for a caller who may read it, timestamps as ISO strings", async () => {
    const response = await read();

    expect(response.status).toBe(200);
    const { data } = await response.json();
    expect(data).toMatchObject({
      id: RESPONSE_ID,
      surveyId: SURVEY_ID,
      createdAt: CREATED_AT.toISOString(),
      updatedAt: UPDATED_AT.toISOString(),
      data: { q1: "Great" },
      quotas: [{ id: "clquota111111111111111111", name: "Under 30" }],
      notShown: null,
      tags: [{ id: TAG_ID, name: "vip", createdAt: CREATED_AT.toISOString() }],
    });
    expect(checkedActions()).toEqual([["response.read", { type: "response", id: RESPONSE_ID }]]);
    expect(mocks.can).toHaveBeenCalledWith(actor, "response.read", { type: "response", id: RESPONSE_ID });
    expect(mocks.getResponseWithQuotas).toHaveBeenCalledWith(RESPONSE_ID);
  });

  test("answers the uniform 403, without reading it, to a caller who may not read the response", async () => {
    mocks.can.mockResolvedValue(false);

    const response = await read();

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toBe("You are not authorized to access this resource");
    expect(mocks.getResponseWithQuotas).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a response gone after the check", async () => {
    mocks.getResponseWithQuotas.mockResolvedValue(null);
    expect((await read()).status).toBe(403);
  });

  test.each([
    ["a malformed id", "not-a-cuid", ""],
    ["an unknown query parameter", RESPONSE_ID, "?workspaceId=x"],
  ])("answers 400 for %s", async (_label, id, query) => {
    expect((await read(id, query)).status).toBe(400);
    expect(mocks.getResponseWithQuotas).not.toHaveBeenCalled();
  });

  test("answers 401 without a session", async () => {
    mocks.getSession.mockResolvedValue(null);
    expect((await read()).status).toBe(401);
  });
});

describe("DELETE /api/internal/responses/{responseId}", () => {
  test("deletes the response for a caller who may write it, revalidates its survey and audits it", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(checkedActions()).toEqual([["response.write", { type: "response", id: RESPONSE_ID }]]);
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, WORKSPACE_ID]]);
    expect(mocks.deleteResponse).toHaveBeenCalledWith(RESPONSE_ID, false);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/surveys/${SURVEY_ID}`);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "deleted",
        targetType: "response",
        status: "success",
        organizationId: ORG_ID,
        targetId: RESPONSE_ID,
        oldObject: expect.objectContaining({ id: RESPONSE_ID, surveyId: SURVEY_ID }),
      })
    );
  });

  test("gives the quota places back when asked", async () => {
    expect((await remove({ query: "?decrementQuotas=true" })).status).toBe(204);
    expect(mocks.deleteResponse).toHaveBeenCalledWith(RESPONSE_ID, true);
  });

  test("answers the uniform 403 to a caller who may not write the response, before the budget", async () => {
    mocks.can.mockResolvedValue(false);

    const response = await remove();

    expect(response.status).toBe(403);
    expect(operationLimits()).toEqual([]);
    expect(mocks.deleteResponse).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "deleted", status: "failure", targetId: RESPONSE_ID })
    );
  });

  test("answers the uniform 403 for a response that doesn't exist", async () => {
    mocks.getResponse.mockResolvedValue(null);
    expect((await remove()).status).toBe(403);
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.deleteResponse).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a response whose survey is gone", async () => {
    mocks.getWorkspaceIdFromSurveyId.mockRejectedValue(new ResourceNotFoundError("survey", SURVEY_ID));
    expect((await remove()).status).toBe(403);
    expect(mocks.deleteResponse).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 for a response deleted meanwhile", async () => {
    mocks.deleteResponse.mockRejectedValue(new ResourceNotFoundError("response", RESPONSE_ID));
    expect((await remove()).status).toBe(403);
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  test("answers 429 when the workspace's write budget is spent", async () => {
    mocks.applyRateLimit.mockImplementation(async (config: { namespace: string }) => {
      if (config.namespace === rateLimitConfigs.actions.stateMutation.namespace) {
        throw new TooManyRequestsError("Maximum number of requests reached. Please try again later.", 60);
      }
    });

    expect((await remove()).status).toBe(429);
    expect(mocks.deleteResponse).not.toHaveBeenCalled();
  });

  test.each([
    ["a decrementQuotas that isn't a boolean", "?decrementQuotas=yes"],
    ["an unknown query parameter", "?force=true"],
  ])("answers 400 for %s", async (_label, query) => {
    expect((await remove({ query })).status).toBe(400);
    expect(mocks.deleteResponse).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await remove({ headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.deleteResponse).not.toHaveBeenCalled();
  });
});

describe("PUT /api/internal/responses/{responseId}/tags/{tagId}", () => {
  test("puts the tag on the response, revalidates its survey and audits the link", async () => {
    const response = await tagRequest("PUT");

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual({ responseId: RESPONSE_ID, tagId: TAG_ID });
    expect(checkedActions()).toEqual([["response.write", { type: "response", id: RESPONSE_ID }]]);
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, WORKSPACE_ID]]);
    expect(mocks.addTagToRespone).toHaveBeenCalledWith(RESPONSE_ID, TAG_ID);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/surveys/${SURVEY_ID}`);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "addedToResponse",
        targetType: "tag",
        status: "success",
        organizationId: ORG_ID,
        targetId: TAG_ID,
        newObject: { responseId: RESPONSE_ID, tagId: TAG_ID },
      })
    );
  });

  test("answers the uniform 403 for a tag from another workspace, before the check", async () => {
    mocks.getTag.mockResolvedValue({ workspaceId: OTHER_WORKSPACE_ID });

    const response = await tagRequest("PUT");

    expect(response.status).toBe(403);
    expect(mocks.can).not.toHaveBeenCalled();
    expect(mocks.addTagToRespone).not.toHaveBeenCalled();
  });

  test.each([
    ["the tag", () => mocks.getTag.mockResolvedValue(null)],
    ["the response", () => mocks.getResponse.mockResolvedValue(null)],
  ])("answers the uniform 403 when %s doesn't exist", async (_label, arrange) => {
    arrange();
    expect((await tagRequest("PUT")).status).toBe(403);
    expect(mocks.addTagToRespone).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 to a caller who may not write the response", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await tagRequest("PUT")).status).toBe(403);
    expect(operationLimits()).toEqual([]);
    expect(mocks.addTagToRespone).not.toHaveBeenCalled();
  });

  test("answers 400 for a malformed tag id", async () => {
    expect((await tagRequest("PUT", { tagId: "not-a-cuid" })).status).toBe(400);
  });

  test("refuses a cross-site request (CSRF)", async () => {
    expect((await tagRequest("PUT", { headers: { "sec-fetch-site": "cross-site" } })).status).toBe(403);
    expect(mocks.addTagToRespone).not.toHaveBeenCalled();
  });
});

describe("DELETE /api/internal/responses/{responseId}/tags/{tagId}", () => {
  test("takes the tag off the response, revalidates its survey and audits the removed link", async () => {
    const response = await tagRequest("DELETE");

    expect(response.status).toBe(204);
    expect(checkedActions()).toEqual([["response.write", { type: "response", id: RESPONSE_ID }]]);
    expect(operationLimits()).toEqual([[rateLimitConfigs.actions.stateMutation.namespace, WORKSPACE_ID]]);
    expect(mocks.deleteTagOnResponse).toHaveBeenCalledWith(RESPONSE_ID, TAG_ID);
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/workspaces/${WORKSPACE_ID}/surveys/${SURVEY_ID}`);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "removedFromResponse",
        targetType: "tag",
        status: "success",
        organizationId: ORG_ID,
        targetId: TAG_ID,
        oldObject: { responseId: RESPONSE_ID, tagId: TAG_ID },
      })
    );
  });

  test("answers the uniform 403 for a tag from another workspace", async () => {
    mocks.getTag.mockResolvedValue({ workspaceId: OTHER_WORKSPACE_ID });
    expect((await tagRequest("DELETE")).status).toBe(403);
    expect(mocks.deleteTagOnResponse).not.toHaveBeenCalled();
  });

  test("answers the uniform 403 to a caller who may not write the response", async () => {
    mocks.can.mockResolvedValue(false);
    expect((await tagRequest("DELETE")).status).toBe(403);
    expect(mocks.deleteTagOnResponse).not.toHaveBeenCalled();
  });

  test("answers 500 for a tag that isn't on the response, as the service raises it", async () => {
    mocks.deleteTagOnResponse.mockRejectedValue(new DatabaseError("Record to delete does not exist."));
    expect((await tagRequest("DELETE")).status).toBe(500);
    expect(mocks.queueAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({ action: "removedFromResponse", status: "failure" })
    );
  });
});
