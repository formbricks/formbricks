import { beforeEach, describe, expect, test, vi } from "vitest";
import type { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  authenticatedApiClient: vi.fn(),
  can: vi.fn(),
  createContact: vi.fn(),
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
vi.mock("./lib/contact", () => ({ createContact: mocks.createContact }));

const workspaceId = "clworkspace0000000000000a";

const callPost = (attributes: Record<string, string>) => {
  mocks.authenticatedApiClient.mockImplementation(
    async ({ handler }: Parameters<typeof authenticatedApiClient>[0]) =>
      await handler({
        request: new Request("http://localhost/api/v2/management/contacts", { method: "POST" }),
        auditLog: undefined,
        authentication: {
          type: "apiKey",
          apiKeyId: "apiKey123",
          organizationId: "org123",
          workspacePermissions: [],
          organizationAccess: { accessControl: { read: true, write: true } },
        },
        parsedInput: { body: { workspaceId, attributes } },
      })
  );
  return POST(new Request("http://localhost/api/v2/management/contacts", { method: "POST" }) as never);
};

describe("POST /management/contacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.can.mockResolvedValue(true);
  });

  test("a workspace with no contact directory gets 403 with the directory message and nothing is created", async () => {
    mocks.getWorkspaceContactDirectory.mockResolvedValue(null);

    const response = await callPost({ email: "a@example.com" });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: {
        code: 403,
        message:
          "A contact directory needs to be set up for this workspace before contacts are available. Ask an organization owner or manager to assign one.",
      },
    });
    expect(mocks.createContact).not.toHaveBeenCalled();
  });

  test("an API key without access learns nothing about the directory", async () => {
    mocks.can.mockResolvedValue(false);

    const response = await callPost({ email: "a@example.com" });

    expect(response.status).toBe(403);
    expect(mocks.getWorkspaceContactDirectory).not.toHaveBeenCalled();
  });

  test("an external-ID directory requires externalId", async () => {
    mocks.getWorkspaceContactDirectory.mockResolvedValue({ id: "dir-1", matchingKey: "externalId" });

    const response = await callPost({ email: "a@example.com" });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          details: [{ field: "attributes", issue: "externalId attribute is required" }],
        }),
      })
    );
    expect(mocks.createContact).not.toHaveBeenCalled();
  });

  test("an email directory still rejects an invalid email", async () => {
    mocks.getWorkspaceContactDirectory.mockResolvedValue({ id: "dir-1", matchingKey: "email" });

    const response = await callPost({ email: "not-an-email" });

    expect(response.status).toBe(422);
    expect(mocks.createContact).not.toHaveBeenCalled();
  });

  test("creates the contact in the workspace's directory", async () => {
    const directory = { id: "dir-1", matchingKey: "externalId" };
    mocks.getWorkspaceContactDirectory.mockResolvedValue(directory);
    mocks.createContact.mockResolvedValue({
      ok: true,
      data: { id: "c1", createdAt: new Date("2026-01-01"), workspaceId, attributes: { externalId: "crm-1" } },
    });

    const response = await callPost({ externalId: "crm-1" });

    expect(response.status).toBe(201);
    expect(mocks.createContact).toHaveBeenCalledWith(
      { workspaceId, attributes: { externalId: "crm-1" } },
      directory
    );
  });
});
