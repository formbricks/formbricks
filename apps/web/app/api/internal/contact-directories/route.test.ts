import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { SAME_ORIGIN_HEADERS } from "@/app/api/v3/lib/test-utils";
import { GET, POST } from "./route";

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  getSession: vi.fn(),
  isContactsEnabled: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  get: vi.fn(),
  queueAuditEvent: vi.fn(),
}));

vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: mocks.isContactsEnabled }));
vi.mock("@/modules/ee/contacts/directories/lib/directory-service", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/modules/ee/contacts/directories/lib/directory-service")>();
  return {
    ...actual,
    listContactDirectories: mocks.list,
    createContactDirectory: mocks.create,
    getContactDirectory: mocks.get,
    getContactDirectoryOrganizationId: vi.fn(),
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

const { ContactDirectoryNameTakenError, ContactDirectoryWorkspacesNotMovableError } =
  await import("@/modules/ee/contacts/directories/lib/directory-errors");

const ORG_ID = "clorg11111111111111111111";
const USER_ID = "cluser1111111111111111111";
const DIRECTORY_ID = "cldir11111111111111111111";
const WS_1 = "clws111111111111111111111";
const WS_2 = "clws222222222222222222222";

const DIRECTORY = {
  id: DIRECTORY_ID,
  name: "Northwind EU",
  matchingKey: "email",
  workspaces: [
    { id: WS_1, name: "HCP" },
    { id: WS_2, name: "Patients" },
  ],
  contactCount: 0,
  workspaceCanMove: false,
};

const URL_BASE = "http://localhost/api/internal/contact-directories";

const get = (query = `organizationId=${ORG_ID}`) => GET(new NextRequest(`${URL_BASE}?${query}`), {});

const post = (body: unknown, query = `organizationId=${ORG_ID}`) =>
  POST(
    new NextRequest(`${URL_BASE}?${query}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...SAME_ORIGIN_HEADERS },
      body: JSON.stringify(body),
    }),
    {}
  );

const lastAudit = () => mocks.queueAuditEvent.mock.calls.at(-1)?.[0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSession.mockResolvedValue({ user: { id: USER_ID } });
  mocks.can.mockResolvedValue(true);
  mocks.isContactsEnabled.mockResolvedValue(true);
  mocks.queueAuditEvent.mockResolvedValue(undefined);
});

describe("GET /api/internal/contact-directories", () => {
  test("lists the organization's directories and workspaces for an owner or manager", async () => {
    const document = {
      directories: [DIRECTORY],
      workspaces: [{ id: WS_1, name: "HCP", directoryId: DIRECTORY_ID }],
    };
    mocks.list.mockResolvedValue(document);

    const response = await get();

    expect(response.status).toBe(200);
    expect((await response.json()).data).toEqual(document);
    expect(mocks.can).toHaveBeenCalledWith({ type: "user", id: USER_ID }, "organization.manage", {
      type: "organization",
      id: ORG_ID,
    });
    expect(mocks.list).toHaveBeenCalledWith(ORG_ID);
  });

  test("answers 401 without a session, 403 to a member or without the Contacts licence, 400 on a stray parameter", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    expect((await get()).status).toBe(401);

    mocks.can.mockResolvedValueOnce(false);
    expect((await get()).status).toBe(403);

    mocks.isContactsEnabled.mockResolvedValueOnce(false);
    expect((await get()).status).toBe(403);

    expect((await get(`organizationId=${ORG_ID}&archived=true`)).status).toBe(400);
    expect(mocks.list).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/contact-directories", () => {
  const body = { name: "Northwind EU", matchingKey: "email", workspaceIds: [WS_1, WS_2] };

  test("creates a directory, answers 201 with it and audits what was created", async () => {
    mocks.create.mockResolvedValue({ id: DIRECTORY_ID });
    mocks.get.mockResolvedValue(DIRECTORY);

    const response = await post(body);

    expect(response.status).toBe(201);
    expect(response.headers.get("Location")).toBe(`/api/internal/contact-directories/${DIRECTORY_ID}`);
    expect((await response.json()).data).toEqual(DIRECTORY);
    expect(mocks.create).toHaveBeenCalledWith({ organizationId: ORG_ID, ...body });
    expect(lastAudit()).toMatchObject({
      action: "created",
      targetType: "contactDirectory",
      targetId: DIRECTORY_ID,
      organizationId: ORG_ID,
      status: "success",
      newObject: { name: "Northwind EU", matchingKey: "email", workspaceIds: [WS_1, WS_2] },
    });
  });

  test("refuses a member with 403 and writes nothing", async () => {
    mocks.can.mockResolvedValue(false);

    expect((await post(body)).status).toBe(403);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("rejects a body without a workspace, with an unknown matching key or with extra fields", async () => {
    expect((await post({ ...body, workspaceIds: [] })).status).toBe(400);
    expect((await post({ ...body, matchingKey: "phone" })).status).toBe(400);
    expect((await post({ ...body, archived: true })).status).toBe(400);
    expect(mocks.create).not.toHaveBeenCalled();
  });

  test("answers 409 for a taken name and for a workspace that can no longer move", async () => {
    mocks.create.mockRejectedValueOnce(new ContactDirectoryNameTakenError());
    const taken = await post(body);
    expect(taken.status).toBe(409);
    expect((await taken.json()).code).toBe("contact_directory_name_taken");

    mocks.create.mockRejectedValueOnce(new ContactDirectoryWorkspacesNotMovableError([WS_2]));
    const notMovable = await post(body);
    expect(notMovable.status).toBe(409);
    expect(await notMovable.json()).toMatchObject({
      code: "contact_directory_workspace_not_movable",
      details: { workspaceIds: [WS_2] },
    });
  });
});
