import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { GET, PATCH } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  isContactsEnabled: vi.fn(),
  get: vi.fn(),
  update: vi.fn(),
  getOrganizationId: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: mocks.isContactsEnabled }));
vi.mock("@/modules/ee/contacts/directories/lib/directory-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/ee/contacts/directories/lib/directory-service")>();
  return {
    ...actual,
    getContactDirectory: mocks.get,
    updateContactDirectory: mocks.update,
    getContactDirectoryOrganizationId: mocks.getOrganizationId,
  };
});
vi.mock("@formbricks/database", () => ({ prisma: {} }));
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

const {
  ContactDirectoryNameRequiredError,
  ContactDirectoryWorkspacesCannotLeaveError,
  ContactDirectoryWorkspacesNotFoundError,
} = await import("@/modules/ee/contacts/directories/lib/directory-errors");

const ORG_ID = "clorg11111111111111111111";
const USER_ID = "cluser1111111111111111111";
const DIRECTORY_ID = "cldir11111111111111111111";
const WS_1 = "clws111111111111111111111";
const WS_2 = "clws222222222222222222222";

const DIRECTORY = {
  id: DIRECTORY_ID,
  name: null,
  matchingKey: "externalId",
  workspaces: [{ id: WS_1, name: "HCP" }],
  contactCount: 12,
  workspaceCanMove: false,
};

const url = `http://localhost/api/internal/contact-directories/${DIRECTORY_ID}`;
const context = { params: Promise.resolve({ directoryId: DIRECTORY_ID }) };

const get = () => GET(new NextRequest(url), context);

const patch = (body: unknown) =>
  PATCH(
    new NextRequest(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...SAME_ORIGIN_HEADERS },
      body: JSON.stringify(body),
    }),
    context
  );

const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.isContactsEnabled.mockResolvedValue(true);
  mocks.getOrganizationId.mockResolvedValue(ORG_ID);
  mocks.get.mockResolvedValue(DIRECTORY);
  mocks.queueAuditEvent.mockResolvedValue(undefined);
});

describe("GET /api/internal/contact-directories/{directoryId}", () => {
  test("returns the directory, authorized against the organization it belongs to", async () => {
    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(DIRECTORY);
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.get).toHaveBeenCalledWith(ORG_ID, DIRECTORY_ID);
  });

  test("answers an unknown directory with the same 403 as one the caller can't manage", async () => {
    mocks.getOrganizationId.mockResolvedValueOnce(null);
    const unknown = await get();

    mocks.can.mockResolvedValueOnce(false);
    const notAllowed = await get();

    expect(unknown.status).toBe(403);
    expect(notAllowed.status).toBe(403);
    expect((await unknown.json()).detail).toBe((await notAllowed.json()).detail);
    expect(mocks.get).not.toHaveBeenCalled();
  });
});

describe("PATCH /api/internal/contact-directories/{directoryId}", () => {
  test("renames and adds workspaces as an owner or manager, auditing before and after", async () => {
    mocks.update.mockResolvedValue({
      previous: { name: null, workspaceIds: [WS_1] },
      next: { name: "Northwind EU", workspaceIds: [WS_1, WS_2] },
    });

    const response = await patch({ name: "Northwind EU", workspaceIds: [WS_1, WS_2] });

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(DIRECTORY);
    expect(mocks.update).toHaveBeenCalledWith({
      organizationId: ORG_ID,
      directoryId: DIRECTORY_ID,
      name: "Northwind EU",
      workspaceIds: [WS_1, WS_2],
    });
    expect(lastAudit()).toMatchObject({
      action: "updated",
      targetType: "contactDirectory",
      targetId: DIRECTORY_ID,
      organizationId: ORG_ID,
      status: "success",
      oldObject: { name: null, workspaceIds: [WS_1] },
      newObject: { name: "Northwind EU", workspaceIds: [WS_1, WS_2] },
    });
  });

  test("refuses a member with 403 and changes nothing", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await patch({ name: "Mine" })).status).toBe(403);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  test("rejects a matching key change, an empty body and an empty workspace list", async () => {
    expect((await patch({ matchingKey: "email" })).status).toBe(400);
    expect((await patch({})).status).toBe(400);
    expect((await patch({ workspaceIds: [] })).status).toBe(400);
    expect(mocks.update).not.toHaveBeenCalled();
  });

  test("answers 422 for a missing name, a workspace leaving and a workspace not in the organization", async () => {
    mocks.update.mockRejectedValueOnce(new ContactDirectoryNameRequiredError());
    const nameRequired = await patch({ workspaceIds: [WS_1, WS_2] });
    expect(nameRequired.status).toBe(422);
    expect(await nameRequired.json()).toMatchObject({
      code: "contact_directory_name_required",
      invalid_params: [{ name: "name", code: "missing_required_field" }],
    });

    mocks.update.mockRejectedValueOnce(new ContactDirectoryWorkspacesCannotLeaveError([WS_1]));
    const leaving = await patch({ workspaceIds: [WS_2] });
    expect(leaving.status).toBe(422);
    expect(await leaving.json()).toMatchObject({
      code: "contact_directory_workspace_cannot_leave",
      details: { workspaceIds: [WS_1] },
    });

    mocks.update.mockRejectedValueOnce(new ContactDirectoryWorkspacesNotFoundError([WS_2]));
    const unknown = await patch({ workspaceIds: [WS_1, WS_2] });
    expect(unknown.status).toBe(422);
    expect(await unknown.json()).toMatchObject({
      invalid_params: [{ name: "workspaceIds", code: "invalid_reference" }],
    });
  });
});
