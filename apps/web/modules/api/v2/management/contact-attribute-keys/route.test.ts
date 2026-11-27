import { beforeEach, describe, expect, test, vi } from "vitest";
import type { authenticatedApiClient } from "@/modules/api/v2/auth/authenticated-api-client";
import { createContactAttributeKey } from "@/modules/api/v2/management/contact-attribute-keys/lib/contact-attribute-key";
import {
  CONTACT_DIRECTORY_MISSING_MESSAGE,
  getWorkspaceContactDirectory,
} from "@/modules/ee/contacts/lib/contact-directory";
import { POST } from "./route";

const { mockAuthenticatedApiClient } = vi.hoisted(() => ({ mockAuthenticatedApiClient: vi.fn() }));

vi.mock("@/modules/api/v2/auth/authenticated-api-client", () => ({
  authenticatedApiClient: mockAuthenticatedApiClient,
}));
vi.mock("@/modules/ee/audit-logs/lib/handler", () => ({ queueAuditEvent: vi.fn(async () => undefined) }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn(async () => true) }));
vi.mock("@/modules/api/v2/management/contact-attribute-keys/lib/contact-attribute-key", () => ({
  createContactAttributeKey: vi.fn(),
  getContactAttributeKeys: vi.fn(),
}));
vi.mock("@/modules/ee/contacts/lib/contact-directory", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/contacts/lib/contact-directory")>()),
  getWorkspaceContactDirectory: vi.fn(),
}));

const workspaceId = "clws0000000000000000000001";
const request = new Request("http://localhost/api/v2/management/contact-attribute-keys", { method: "POST" });

describe("POST /api/v2/management/contact-attribute-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthenticatedApiClient.mockImplementation(
      async ({ handler }: Parameters<typeof authenticatedApiClient>[0]) =>
        await handler({
          request,
          auditLog: undefined,
          authentication: {
            type: "apiKey",
            apiKeyId: "apiKey123",
            organizationId: "org123",
            workspacePermissions: [{ workspaceId, workspaceName: "Workspace", permission: "write" }],
            organizationAccess: { accessControl: { read: true, write: true } },
          },
          parsedInput: { body: { workspaceId, key: "plan", name: "Plan" } },
        } as never)
    );
  });

  test("answers 403 with the no-directory message and creates no key when the workspace has no directory", async () => {
    vi.mocked(getWorkspaceContactDirectory).mockResolvedValue(null);

    const response = await POST(request as never);

    expect(response.status).toBe(403);
    expect((await response.json()).error.message).toBe(CONTACT_DIRECTORY_MISSING_MESSAGE);
    expect(createContactAttributeKey).not.toHaveBeenCalled();
  });

  test("creates the key when the workspace has a directory", async () => {
    vi.mocked(getWorkspaceContactDirectory).mockResolvedValue({ id: "cldir", matchingKey: "email" });
    vi.mocked(createContactAttributeKey).mockResolvedValue({ ok: true, data: { id: "clcontact" } } as never);

    const response = await POST(request as never);

    expect(response.status).toBe(201);
    expect(createContactAttributeKey).toHaveBeenCalledOnce();
  });
});
