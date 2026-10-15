import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  AuthorizationError,
  InvalidInputError,
  OperationNotAllowedError,
  ResourceNotFoundError,
  TooManyRequestsError,
} from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import {
  EmbeddedDataInUseError,
  EmbeddedDataKeyConflictError,
  type TEmbeddedDataUsageItem,
} from "@/modules/embedded-data/types";
import { POST as PROMOTE } from "./[embeddedDataId]/promotion/route";
import { DELETE, PATCH } from "./[embeddedDataId]/route";
import { GET as USAGE } from "./[embeddedDataId]/usage/route";
import { POST as CREATE, GET as LIST } from "./route";

const mocks = vi.hoisted(() => ({
  assertCan: vi.fn(),
  getSession: vi.fn(),
  resolveWorkspace: vi.fn(),
  getOrganizationId: vi.fn(),
  applyRateLimit: vi.fn(),
  queueAuditEvent: vi.fn(),
  library: {
    getSharedEmbeddedData: vi.fn(),
    getEmbeddedDataUsage: vi.fn(),
    getEmbeddedDataWorkspaceId: vi.fn(),
    getSharedEmbeddedDataById: vi.fn(),
    getLocalEmbeddedDataById: vi.fn(),
    createSharedEmbeddedData: vi.fn(),
    updateSharedEmbeddedData: vi.fn(),
    deleteSharedEmbeddedData: vi.fn(),
    promoteEmbeddedDataToShared: vi.fn(),
  },
}));

vi.mock("@/lib/authorization", () => ({ assertCan: mocks.assertCan, can: vi.fn() }));
vi.mock("@/app/api/v3/lib/workspace-context", () => ({ resolveV3WorkspaceContext: mocks.resolveWorkspace }));
vi.mock("@/lib/utils/helper", () => ({ getOrganizationIdFromWorkspaceId: mocks.getOrganizationId }));
vi.mock("@/modules/embedded-data/lib/library", () => mocks.library);
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
const WORKSPACE_ID = "clwork1111111111111111111";
const OTHER_WORKSPACE_ID = "clwork2222222222222222222";
const ORG_ID = "clorg11111111111111111111";
const FIELD_ID = "clfield111111111111111111";
const EXISTING_ID = "clfield222222222222222222";
const CREATED_AT = new Date("2026-10-01T10:00:00.000Z");

const row = (overrides: Record<string, unknown> = {}) => ({
  id: FIELD_ID,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  key: "plan_tier",
  name: "Plan tier",
  description: null,
  source: "ingested",
  dataType: "string",
  defaultValue: null,
  locked: false,
  surveyId: null,
  workspaceId: WORKSPACE_ID,
  ...overrides,
});

const resource = (overrides: Record<string, unknown> = {}) => ({
  id: FIELD_ID,
  key: "plan_tier",
  name: "Plan tier",
  description: null,
  source: "ingested",
  dataType: "string",
  defaultValue: null,
  locked: false,
  createdAt: CREATED_AT.toISOString(),
  updatedAt: CREATED_AT.toISOString(),
  ...overrides,
});

const USAGE_ITEMS: TEmbeddedDataUsageItem[] = [
  { id: "clsurv1111111111111111111", name: "Onboarding", status: "inProgress" },
];

type TRequestOptions = { headers?: Record<string, string> };

const request = (method: string, url: string, body?: unknown, { headers }: TRequestOptions = {}) =>
  new NextRequest(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...SAME_ORIGIN_HEADERS,
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const base = "http://localhost/api/internal/embedded-data";
const fieldProps = (id = FIELD_ID) => ({ params: Promise.resolve({ embeddedDataId: id }) }) as never;
const noProps = { params: Promise.resolve({}) } as never;

const list = (workspaceId = WORKSPACE_ID) =>
  LIST(request("GET", `${base}?workspaceId=${workspaceId}`), noProps);
const create = (body: unknown, workspaceId = WORKSPACE_ID, options?: TRequestOptions) =>
  CREATE(request("POST", `${base}?workspaceId=${workspaceId}`, body, options), noProps);
const usage = (id = FIELD_ID) => USAGE(request("GET", `${base}/${id}/usage`), fieldProps(id));
const update = (body: unknown, id = FIELD_ID) =>
  PATCH(request("PATCH", `${base}/${id}`, body), fieldProps(id));
const remove = (id = FIELD_ID, options?: TRequestOptions) =>
  DELETE(request("DELETE", `${base}/${id}`, undefined, options), fieldProps(id));
const promote = (body: unknown, id = FIELD_ID) =>
  PROMOTE(request("POST", `${base}/${id}/promotion`, body), fieldProps(id));

const actor = { type: "user", id: USER_ID };
const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.assertCan.mockResolvedValue(undefined);
  mocks.resolveWorkspace.mockImplementation(async (workspaceId: string) => ({
    workspaceId,
    organizationId: ORG_ID,
  }));
  mocks.getOrganizationId.mockResolvedValue(ORG_ID);
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.library.getEmbeddedDataWorkspaceId.mockResolvedValue(WORKSPACE_ID);
  mocks.library.getSharedEmbeddedData.mockResolvedValue([{ ...row(), surveyCount: 2 }]);
  mocks.library.getEmbeddedDataUsage.mockResolvedValue(USAGE_ITEMS);
  mocks.library.getSharedEmbeddedDataById.mockResolvedValue(row());
  mocks.library.getLocalEmbeddedDataById.mockResolvedValue(
    row({ key: null, surveyId: "clsurv1111111111111111111" })
  );
  mocks.library.createSharedEmbeddedData.mockResolvedValue(row());
  mocks.library.updateSharedEmbeddedData.mockResolvedValue(row({ name: "Renamed" }));
  mocks.library.deleteSharedEmbeddedData.mockResolvedValue(row());
  mocks.library.promoteEmbeddedDataToShared.mockResolvedValue(row());
});

describe("reads", () => {
  test("lists the library behind workspace.read, with ISO dates and no workspace or survey ids", async () => {
    const response = await list();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual([{ ...resource(), surveyCount: 2 }]);
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "workspace.read", {
      type: "workspace",
      id: WORKSPACE_ID,
    });
    // Reads spend only the wrapper's request budget, never the per-workspace write budget.
    expect(mocks.applyRateLimit).not.toHaveBeenCalledWith(
      rateLimitConfigs.actions.stateMutation,
      expect.anything()
    );
  });

  test("refuses a workspace the caller can't read with 403", async () => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    expect((await list()).status).toBe(403);
    expect(mocks.library.getSharedEmbeddedData).not.toHaveBeenCalled();
  });

  test("reads usage against the workspace on the row, not one the caller names", async () => {
    mocks.library.getEmbeddedDataWorkspaceId.mockResolvedValue(OTHER_WORKSPACE_ID);
    const response = await usage();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(USAGE_ITEMS);
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "workspace.read", {
      type: "workspace",
      id: OTHER_WORKSPACE_ID,
    });
    expect(mocks.library.getEmbeddedDataUsage).toHaveBeenCalledWith(FIELD_ID, OTHER_WORKSPACE_ID);
  });
});

describe("workspace scope", () => {
  const withoutRequestId = async (response: Response) => {
    const { requestId: _requestId, ...rest } = await response.json();
    return rest;
  };

  test.each([
    ["usage", () => usage()],
    ["update", () => update({ name: "Renamed" })],
    ["delete", () => remove()],
    ["promote", () => promote({ key: "plan_tier" })],
  ])("%s answers an id no row has with the same 403 as an unreachable row", async (_name, send) => {
    mocks.library.getEmbeddedDataWorkspaceId.mockResolvedValue(null);
    const missing = await send();
    expect(mocks.assertCan).not.toHaveBeenCalled();

    mocks.library.getEmbeddedDataWorkspaceId.mockResolvedValue(OTHER_WORKSPACE_ID);
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));
    const unreachable = await send();

    expect(missing.status).toBe(403);
    expect(unreachable.status).toBe(403);
    expect(await withoutRequestId(missing)).toEqual(await withoutRequestId(unreachable));
  });

  test.each([
    ["update", () => update({ name: "Renamed" })],
    ["delete", () => remove()],
    ["promote", () => promote({ key: "plan_tier" })],
  ])("%s authorizes and rate-limits against the workspace read off the row", async (_name, send) => {
    mocks.library.getEmbeddedDataWorkspaceId.mockResolvedValue(OTHER_WORKSPACE_ID);

    expect((await send()).ok).toBe(true);
    expect(mocks.assertCan).toHaveBeenCalledWith(actor, "workspace.write", {
      type: "workspace",
      id: OTHER_WORKSPACE_ID,
    });
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(
      rateLimitConfigs.actions.stateMutation,
      OTHER_WORKSPACE_ID
    );
  });

  test.each([
    ["update", () => update({ name: "Renamed" })],
    ["delete", () => remove()],
    ["promote", () => promote({ key: "plan_tier" })],
  ])("%s names its target in a refused write's audit entry", async (_name, send) => {
    mocks.assertCan.mockRejectedValue(new AuthorizationError("Not authorized"));

    expect((await send()).status).toBe(403);
    expect(lastAudit()).toMatchObject({ status: "failure", organizationId: ORG_ID, targetId: FIELD_ID });
  });

  test("a read-only member can't write", async () => {
    mocks.assertCan.mockImplementation(async (_actor: unknown, action: string) => {
      if (action !== "workspace.read") throw new AuthorizationError("Not authorized");
    });

    expect((await create({ key: "plan_tier", name: "Plan tier", source: "ingested" })).status).toBe(403);
    expect((await update({ name: "Renamed" })).status).toBe(403);
    expect((await remove()).status).toBe(403);
    expect(mocks.library.createSharedEmbeddedData).not.toHaveBeenCalled();
    expect(mocks.library.updateSharedEmbeddedData).not.toHaveBeenCalled();
    expect(mocks.library.deleteSharedEmbeddedData).not.toHaveBeenCalled();
  });
});

describe("writes", () => {
  test("create passes the library input on, answers 201 with a Location, and audits the new row", async () => {
    const body = { key: "plan_tier", name: "Plan tier", source: "ingested", dataType: "string" };
    const response = await create(body);

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/internal/embedded-data/${FIELD_ID}`);
    expect((await response.json()).data).toEqual(resource());
    expect(mocks.library.createSharedEmbeddedData).toHaveBeenCalledWith(WORKSPACE_ID, body);
    expect(mocks.applyRateLimit).toHaveBeenCalledWith(rateLimitConfigs.actions.stateMutation, WORKSPACE_ID);
    expect(lastAudit()).toMatchObject({
      action: "created",
      targetType: "embeddedData",
      status: "success",
      organizationId: ORG_ID,
      targetId: FIELD_ID,
      newObject: row(),
    });
  });

  test("update forwards the acknowledgement as an option and audits both sides", async () => {
    const response = await update({ dataType: "number", acknowledgeExistingResponses: true });

    expect(response.status).toBe(200);
    expect((await response.json()).data.name).toBe("Renamed");
    expect(mocks.library.updateSharedEmbeddedData).toHaveBeenCalledWith(
      FIELD_ID,
      WORKSPACE_ID,
      { dataType: "number" },
      { acknowledgeExistingResponses: true }
    );
    expect(lastAudit()).toMatchObject({
      status: "success",
      oldObject: row(),
      newObject: row({ name: "Renamed" }),
    });
  });

  test("delete answers 204 and keeps the removed row as the whole audit record", async () => {
    const response = await remove();

    expect(response.status).toBe(204);
    expect(mocks.library.deleteSharedEmbeddedData).toHaveBeenCalledWith(FIELD_ID, WORKSPACE_ID);
    expect(lastAudit()).toMatchObject({ action: "deleted", status: "success", oldObject: row() });
  });

  test("promote sends only the library key and records the local row it was before", async () => {
    const response = await promote({ key: "plan_tier", description: "Paid plan" });

    expect(response.status).toBe(200);
    expect(mocks.library.promoteEmbeddedDataToShared).toHaveBeenCalledWith(FIELD_ID, WORKSPACE_ID, {
      key: "plan_tier",
      description: "Paid plan",
    });
    expect(lastAudit()).toMatchObject({
      action: "updated",
      status: "success",
      oldObject: expect.objectContaining({ key: null }),
      newObject: row(),
    });
  });
});

describe("refusals", () => {
  test("a delete blocked by surveys is a 409 naming them, and records no audit event", async () => {
    mocks.library.deleteSharedEmbeddedData.mockRejectedValue(
      new EmbeddedDataInUseError("Cannot delete a field that is used by a survey", USAGE_ITEMS)
    );
    const response = await remove();
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.detail).toBe("Cannot delete a field that is used by a survey");
    expect(body.details).toEqual({ reason: "in_use", usage: USAGE_ITEMS });
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("a data type change blocked by responses is a 409 naming the surveys holding them", async () => {
    mocks.library.updateSharedEmbeddedData.mockRejectedValue(
      new EmbeddedDataInUseError("Responses already hold values of the old type", USAGE_ITEMS)
    );
    const response = await update({ dataType: "number" });

    expect(response.status).toBe(409);
    expect((await response.json()).details).toEqual({ reason: "in_use", usage: USAGE_ITEMS });
  });

  test("a promote onto a taken key is a 409 carrying the row holding it", async () => {
    mocks.library.promoteEmbeddedDataToShared.mockRejectedValue(
      new EmbeddedDataKeyConflictError(EXISTING_ID)
    );
    const response = await promote({ key: "plan_tier" });

    expect(response.status).toBe(409);
    expect((await response.json()).details).toEqual({ reason: "key_conflict", existingId: EXISTING_ID });
    expect(mocks.queueAuditEvent).not.toHaveBeenCalled();
  });

  test("a create onto a taken key is a 409 with no row to offer", async () => {
    mocks.library.createSharedEmbeddedData.mockRejectedValue(new EmbeddedDataKeyConflictError());
    const response = await create({ key: "plan_tier", name: "Plan tier", source: "ingested" });

    expect(response.status).toBe(409);
    expect((await response.json()).details).toEqual({ reason: "key_conflict", existingId: null });
  });

  test("an input the service refuses is a 400 with its message, and is audited as a failure", async () => {
    mocks.library.createSharedEmbeddedData.mockRejectedValue(
      new InvalidInputError("Key matches the name of a reserved field")
    );
    const response = await create({ key: "userId", name: "User", source: "ingested" });

    expect(response.status).toBe(400);
    expect((await response.json()).detail).toBe("Key matches the name of a reserved field");
    expect(lastAudit()).toMatchObject({ status: "failure" });
  });

  test("a write during an online upgrade is a 503 saying so", async () => {
    mocks.library.updateSharedEmbeddedData.mockRejectedValue(
      new OperationNotAllowedError("This change is unavailable until the online upgrade completes")
    );
    const response = await update({ name: "Renamed" });

    expect(response.status).toBe(503);
    expect((await response.json()).detail).toBe(
      "This change is unavailable until the online upgrade completes"
    );
  });

  test("a row deleted mid-request answers the same 403 as one the caller can't reach", async () => {
    mocks.library.updateSharedEmbeddedData.mockRejectedValue(
      new ResourceNotFoundError("embeddedData", FIELD_ID)
    );
    expect((await update({ name: "Renamed" })).status).toBe(403);
  });

  test("the per-workspace write budget answers 429", async () => {
    mocks.applyRateLimit.mockRejectedValue(new TooManyRequestsError("Rate limit exceeded", 30));
    expect((await update({ name: "Renamed" })).status).toBe(429);
    expect(mocks.library.updateSharedEmbeddedData).not.toHaveBeenCalled();
  });

  test.each([
    ["a key change, which is immutable", () => update({ key: "other" })],
    ["a source change, which is immutable", () => update({ source: "computed" })],
    ["a create without a source", () => create({ key: "plan_tier", name: "Plan tier" })],
    ["a malformed workspace id", () => create({ key: "k", name: "n", source: "ingested" }, "not a cuid")],
    ["a malformed field id", () => remove("not a cuid")],
  ])("answers 400 for %s", async (_label, send) => {
    expect((await send()).status).toBe(400);
    expect(mocks.library.updateSharedEmbeddedData).not.toHaveBeenCalled();
    expect(mocks.library.createSharedEmbeddedData).not.toHaveBeenCalled();
    expect(mocks.library.deleteSharedEmbeddedData).not.toHaveBeenCalled();
  });

  test("refuses cross-site writes (CSRF)", async () => {
    const crossSite = { headers: { "sec-fetch-site": "cross-site" } };
    expect((await create({ key: "k", name: "n", source: "ingested" }, WORKSPACE_ID, crossSite)).status).toBe(
      403
    );
    expect((await remove(FIELD_ID, crossSite)).status).toBe(403);
    expect(mocks.library.createSharedEmbeddedData).not.toHaveBeenCalled();
    expect(mocks.library.deleteSharedEmbeddedData).not.toHaveBeenCalled();
  });
});
