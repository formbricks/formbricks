import { beforeEach, describe, expect, test, vi } from "vitest";
import type { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import type { TContactBulkUploadContact } from "@/modules/ee/contacts/types/contact";
import { PUT } from "./route";

const mocks = vi.hoisted(() => ({
  authenticatedApiClient: vi.fn(),
  can: vi.fn(),
  upsertBulkContacts: vi.fn(),
  getWorkspaceContactDirectory: vi.fn(),
}));

vi.mock("@/modules/api/v2/auth/authenticated-api-client", () => ({
  authenticatedApiClient: mocks.authenticatedApiClient,
}));
vi.mock("@/lib/authorization", () => ({ can: mocks.can }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn(async () => true) }));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: vi.fn() }));
vi.mock("@/app/lib/api/api-error-reporter", () => ({ reportApiError: vi.fn() }));
vi.mock("@/modules/api/v2/management/lib/workspace-resolver", () => ({ resolveBodyIdsV2: vi.fn() }));
vi.mock("@/modules/ee/contacts/lib/contact-directory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/contacts/lib/contact-directory")>()),
  getWorkspaceContactDirectory: mocks.getWorkspaceContactDirectory,
  // The route reads the directory again after the guard; both go through the same mock.
  requireWorkspaceContactDirectory: (workspaceId: string) => mocks.getWorkspaceContactDirectory(workspaceId),
}));
vi.mock("./lib/contact", () => ({ upsertBulkContacts: mocks.upsertBulkContacts }));

const workspaceId = "clworkspace0000000000000a";

const contact = (attributes: Record<string, string>): TContactBulkUploadContact => ({
  attributes: Object.entries(attributes).map(([key, value]) => ({ attributeKey: { key, name: key }, value })),
});

const callPut = (contacts: TContactBulkUploadContact[]) => {
  mocks.authenticatedApiClient.mockImplementation(
    async ({ handler }: Parameters<typeof authenticatedApiClient>[0]) =>
      await handler({
        request: new Request("http://localhost/api/v2/management/contacts/bulk", { method: "PUT" }),
        auditLog: undefined,
        authentication: {
          type: "apiKey",
          apiKeyId: "apiKey123",
          organizationId: "org123",
          workspacePermissions: [],
          organizationAccess: { accessControl: { read: true, write: true } },
        },
        parsedInput: { body: { workspaceId, contacts } },
      })
  );
  return PUT(new Request("http://localhost/api/v2/management/contacts/bulk", { method: "PUT" }));
};

describe("PUT /management/contacts/bulk", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.can.mockResolvedValue(true);
  });

  test("a workspace with no contact directory gets 403 with the directory message and nothing is written", async () => {
    mocks.getWorkspaceContactDirectory.mockResolvedValue(null);

    const response = await callPut([contact({ email: "a@example.com" })]);

    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.message).toMatch(/^A contact directory needs to be set up for this workspace/);
    expect(mocks.upsertBulkContacts).not.toHaveBeenCalled();
  });

  test("an external-ID directory requires externalId on every contact", async () => {
    mocks.getWorkspaceContactDirectory.mockResolvedValue({ id: "dir-1", matchingKey: "externalId" });

    const response = await callPut([contact({ externalId: "crm-1" }), contact({ email: "b@example.com" })]);

    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.details).toEqual([
      { field: "contacts", issue: "externalId attribute is required for contact at index 1" },
    ]);
    expect(mocks.upsertBulkContacts).not.toHaveBeenCalled();
  });

  test("upserts into the workspace's directory and keeps the response shape", async () => {
    const directory = { id: "dir-1", matchingKey: "email" };
    mocks.getWorkspaceContactDirectory.mockResolvedValue(directory);
    mocks.upsertBulkContacts.mockResolvedValue({ ok: true, data: { contactIdxWithConflictingUserIds: [] } });
    const contacts = [contact({ email: "a@example.com" })];

    const response = await callPut(contacts);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: { status: "success", message: "Contacts bulk upload successful" },
    });
    expect(mocks.upsertBulkContacts).toHaveBeenCalledWith(contacts, workspaceId, directory);
    expect(mocks.getWorkspaceContactDirectory).toHaveBeenCalledTimes(1);
  });
});
