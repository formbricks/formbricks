import { NextRequest } from "next/server";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { resolveBodyIds } from "@/app/api/v1/management/lib/workspace-resolver";
import { CONTACT_DIRECTORY_MISSING_MESSAGE } from "@/modules/ee/contacts/lib/contact-directory";
import { createContactAttributeKey } from "./lib/contact-attribute-keys";
import { POST } from "./route";

// The wrapper is reduced to its handler: authentication, rate limiting and audit logging are not what
// this file proves.
vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));
vi.mock("@/app/api/v1/management/lib/workspace-resolver", () => ({ resolveBodyIds: vi.fn() }));
vi.mock("@/lib/authorization", () => ({ can: vi.fn(async () => true) }));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn(async () => true) }));
vi.mock("./lib/contact-attribute-keys", () => ({
  createContactAttributeKey: vi.fn(),
  getContactAttributeKeys: vi.fn(),
}));
// The real directory resolver runs over this read.
vi.mock("@formbricks/database", () => ({ prisma: { workspace: { findUnique: vi.fn() } } }));

const workspaceId = "clws0000000000000000000001";
const body = { workspaceId, key: "plan", name: "Plan", type: "custom" };

const post = () =>
  (POST as unknown as (params: Record<string, unknown>) => Promise<{ response: Response }>)({
    req: new NextRequest("http://localhost/api/v1/management/contact-attribute-keys", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    props: {},
    authentication: {
      type: "apiKey",
      apiKeyId: "apiKey123",
      organizationId: "org123",
      workspacePermissions: [{ workspaceId, workspaceName: "Workspace", permission: "write" }],
    },
  });

describe("POST /api/v1/management/contact-attribute-keys", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(resolveBodyIds).mockResolvedValue({ ok: true, body, alreadyAuthorized: true } as never);
  });

  test("answers 403 with the no-directory message and creates no key when the workspace has no directory", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({ contactDirectory: null } as never);

    const { response } = await post();

    expect(response.status).toBe(403);
    expect((await response.json()).message).toBe(CONTACT_DIRECTORY_MISSING_MESSAGE);
    expect(createContactAttributeKey).not.toHaveBeenCalled();
  });

  test("creates the key when the workspace has a directory", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      contactDirectory: { id: "cldir", matchingKey: "email" },
    } as never);
    vi.mocked(createContactAttributeKey).mockResolvedValue({ id: "clkey" } as never);

    const { response } = await post();

    expect(response.status).toBe(200);
    expect(createContactAttributeKey).toHaveBeenCalledOnce();
  });
});
