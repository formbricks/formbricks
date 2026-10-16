import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { InvalidInputError, ResourceNotFoundError } from "@formbricks/types/errors";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { rateLimitConfigs } from "@/modules/core/rate-limit/rate-limit-configs";
import { GET, PATCH } from "./[datasetId]/route";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  isEnabled: vi.fn(),
  getOrganizationIdFromDirectoryId: vi.fn(),
  createFeedbackDirectory: vi.fn(),
  updateFeedbackDirectory: vi.fn(),
  getFeedbackDirectoryDetails: vi.fn(),
  capturePostHogEvent: vi.fn(),
  queueAuditEvent: vi.fn(),
  applyRateLimit: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsFeedbackDirectoriesEnabled: mocks.isEnabled }));
vi.mock("@/modules/ee/feedback-directory/lib/feedback-directory", () => ({
  getOrganizationIdFromDirectoryId: mocks.getOrganizationIdFromDirectoryId,
  createFeedbackDirectory: mocks.createFeedbackDirectory,
  updateFeedbackDirectory: mocks.updateFeedbackDirectory,
  getFeedbackDirectoryDetails: mocks.getFeedbackDirectoryDetails,
}));
vi.mock("@/modules/hub/service", () => ({ purgeHubFeedbackRecords: vi.fn() }));
vi.mock("@/lib/posthog", () => ({ capturePostHogEvent: mocks.capturePostHogEvent }));
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
const OTHER_ORG_ID = "clorg22222222222222222222";
const DATASET_ID = "cldata1111111111111111111";
const WORKSPACE_ID = "clwork1111111111111111111";

const details = (overrides: Record<string, unknown> = {}) => ({
  id: DATASET_ID,
  name: "Support",
  isArchived: false,
  organizationId: ORG_ID,
  workspaces: [{ workspaceId: WORKSPACE_ID, workspaceName: "Web" }],
  feedbackSources: [],
  ...overrides,
});

type TOptions = { headers?: Record<string, string> };
const send = (method: string, url: string, body?: unknown, { headers }: TOptions = {}) =>
  new NextRequest(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...SAME_ORIGIN_HEADERS,
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

const base = "http://localhost/api/internal/feedback-datasets";
const datasetProps = (id = DATASET_ID) => ({ params: Promise.resolve({ datasetId: id }) }) as never;

const create = (body: unknown, organizationId = ORG_ID, options?: TOptions) =>
  POST(send("POST", `${base}?organizationId=${organizationId}`, body, options), {
    params: Promise.resolve({}),
  } as never);
const read = (id = DATASET_ID) => GET(send("GET", `${base}/${id}`), datasetProps(id));
const update = (body: unknown, id = DATASET_ID) =>
  PATCH(send("PATCH", `${base}/${id}`, body), datasetProps(id));

const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];
const withoutRequestId = async (response: Response) => {
  const { requestId: _requestId, ...rest } = await response.json();
  return rest;
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.applyRateLimit.mockResolvedValue(undefined);
  mocks.can.mockResolvedValue(true);
  mocks.isEnabled.mockResolvedValue(true);
  mocks.getOrganizationIdFromDirectoryId.mockResolvedValue(ORG_ID);
  mocks.createFeedbackDirectory.mockResolvedValue(DATASET_ID);
  mocks.updateFeedbackDirectory.mockResolvedValue(true);
  mocks.getFeedbackDirectoryDetails.mockResolvedValue(details());
});

describe("POST /api/internal/feedback-datasets", () => {
  test("lets an owner or manager create a dataset: 201 with its details and a Location", async () => {
    const response = await create({ name: "Support", workspaceIds: [WORKSPACE_ID] });

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/internal/feedback-datasets/${DATASET_ID}`);
    expect((await response.json()).data).toEqual(details());
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.createFeedbackDirectory).toHaveBeenCalledWith(ORG_ID, "Support", [WORKSPACE_ID]);
    expect(mocks.capturePostHogEvent).toHaveBeenCalledWith(
      USER_ID,
      "feedback_directory_created",
      { feedback_directory_id: DATASET_ID },
      { organizationId: ORG_ID }
    );
    expect(lastAudit()).toMatchObject({
      action: "created",
      targetType: "feedbackDirectory",
      status: "success",
      organizationId: ORG_ID,
      targetId: DATASET_ID,
      newObject: details(),
    });
  });

  test("refuses a member with 403 before saying anything about the licence", async () => {
    mocks.can.mockResolvedValue(false);
    const response = await create({ name: "Support" });

    expect(response.status).toBe(403);
    expect(mocks.isEnabled).not.toHaveBeenCalled();
    expect(mocks.createFeedbackDirectory).not.toHaveBeenCalled();
    expect(lastAudit()).toMatchObject({ status: "failure", organizationId: ORG_ID });
  });

  test("refuses an organization without the feedback directories entitlement", async () => {
    mocks.isEnabled.mockResolvedValue(false);
    const response = await create({ name: "Support" });

    expect(response.status).toBe(403);
    expect((await response.json()).detail).toMatch(/not enabled/);
    expect(mocks.createFeedbackDirectory).not.toHaveBeenCalled();
  });

  test("answers a taken name with 409 and the code the settings page translates", async () => {
    mocks.createFeedbackDirectory.mockRejectedValue(new InvalidInputError("DIRECTORY_NAME_DUPLICATE"));
    const response = await create({ name: "Support" });
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.detail).toBe("DIRECTORY_NAME_DUPLICATE");
    expect(body.details).toEqual({ reason: "DIRECTORY_NAME_DUPLICATE" });
  });

  test("answers another organization's workspace with 422", async () => {
    mocks.createFeedbackDirectory.mockRejectedValue(
      new InvalidInputError("DIRECTORY_WORKSPACES_INVALID_ORG")
    );
    const response = await create({ name: "Support", workspaceIds: [WORKSPACE_ID] });

    expect(response.status).toBe(422);
    expect((await response.json()).details).toEqual({ reason: "DIRECTORY_WORKSPACES_INVALID_ORG" });
  });

  test.each([
    ["a blank name", { name: "  " }],
    ["no name", {}],
    ["an unknown field", { name: "Support", organizationId: OTHER_ORG_ID }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await create(body)).status).toBe(400);
    expect(mocks.createFeedbackDirectory).not.toHaveBeenCalled();
  });

  test("refuses a cross-site request (CSRF)", async () => {
    const response = await create({ name: "Support" }, ORG_ID, {
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(response.status).toBe(403);
    expect(mocks.createFeedbackDirectory).not.toHaveBeenCalled();
  });
});

describe("GET /api/internal/feedback-datasets/{datasetId}", () => {
  test("returns the dataset with its workspaces and sources", async () => {
    const response = await read();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(details());
  });

  test("checks the caller against the dataset's own organization, and answers a missing dataset the same", async () => {
    mocks.getOrganizationIdFromDirectoryId.mockResolvedValue(OTHER_ORG_ID);
    mocks.can.mockImplementation(
      async (_actor: unknown, _action: string, resource: { id: string }) => resource.id === ORG_ID
    );
    const otherOrganization = await read();

    mocks.getOrganizationIdFromDirectoryId.mockRejectedValue(
      new ResourceNotFoundError("FeedbackDirectory", DATASET_ID)
    );
    const missing = await read();

    expect(otherOrganization.status).toBe(403);
    expect(await withoutRequestId(otherOrganization)).toEqual(await withoutRequestId(missing));
    expect(mocks.getFeedbackDirectoryDetails).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/internal/feedback-datasets/{datasetId}", () => {
  test("archives a dataset and audits both sides", async () => {
    mocks.getFeedbackDirectoryDetails
      .mockResolvedValueOnce(details())
      .mockResolvedValueOnce(details({ isArchived: true }));
    const response = await update({ isArchived: true });

    expect(response.status).toBe(200);
    expect((await response.json()).data.isArchived).toBe(true);
    expect(mocks.updateFeedbackDirectory).toHaveBeenCalledWith(DATASET_ID, ORG_ID, { isArchived: true });
    expect(lastAudit()).toMatchObject({
      action: "updated",
      status: "success",
      organizationId: ORG_ID,
      targetId: DATASET_ID,
      oldObject: details(),
      newObject: details({ isArchived: true }),
    });
  });

  test("answers 409 when the dataset's workspaces still have sources", async () => {
    mocks.updateFeedbackDirectory.mockRejectedValue(
      new InvalidInputError("DIRECTORY_WORKSPACE_HAS_FEEDBACK_SOURCES")
    );
    const response = await update({ workspaceIds: [] });

    expect(response.status).toBe(409);
    expect((await response.json()).details).toEqual({ reason: "DIRECTORY_WORKSPACE_HAS_FEEDBACK_SOURCES" });
  });

  test("refuses a member with 403, and names the dataset in the failed audit entry", async () => {
    mocks.can.mockResolvedValue(false);
    const response = await update({ name: "Renamed" });

    expect(response.status).toBe(403);
    expect(mocks.updateFeedbackDirectory).not.toHaveBeenCalled();
    expect(lastAudit()).toMatchObject({ status: "failure", targetId: DATASET_ID });
  });

  test.each([
    ["a blank name", { name: " " }],
    ["a field it does not take", { organizationId: OTHER_ORG_ID }],
  ])("answers 400 for %s", async (_label, body) => {
    expect((await update(body)).status).toBe(400);
    expect(mocks.updateFeedbackDirectory).not.toHaveBeenCalled();
  });
});

describe("every dataset route", () => {
  test.each([
    ["create", () => create({ name: "Support" }), true],
    ["read", () => read(), false],
    ["update", () => update({ name: "Renamed" }), true],
  ])("%s authorizes organization.manage on the dataset's organization", async (_name, call, isWrite) => {
    expect((await call()).ok).toBe(true);

    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    // Writes spend the per-user directory budget; a read never does.
    const spentWriteBudget = mocks.applyRateLimit.mock.calls.some(
      ([config]) => config === rateLimitConfigs.actions.feedbackDirectoryMutation
    );
    expect(spentWriteBudget).toBe(isWrite);
  });
});
