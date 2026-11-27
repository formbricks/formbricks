import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { V1_MANAGEMENT_MAX_LIMIT } from "@/app/api/v1/management/lib/pagination";
import { CONTACT_DIRECTORY_MISSING_MESSAGE } from "@/modules/ee/contacts/lib/contact-directory";
import { getContactAttributes } from "./lib/contact-attributes";
import { GET } from "./route";

// The wrapper is reduced to its handler: authentication, rate limiting and audit logging are not what
// this file proves.
vi.mock("@/app/lib/api/with-api-logging", () => ({
  withV1ApiWrapper: ({ handler }: { handler: unknown }) => handler,
}));
vi.mock("@/modules/ee/license-check/lib/utils", () => ({ getIsContactsEnabled: vi.fn(async () => true) }));
vi.mock("./lib/contact-attributes", () => ({ getContactAttributes: vi.fn(async () => []) }));
// The real directory resolver runs over this read.
vi.mock("@formbricks/database", () => ({ prisma: { workspace: { findUnique: vi.fn() } } }));

const get = (workspaceIds: string[]) =>
  (GET as unknown as (params: Record<string, unknown>) => Promise<{ response: Response }>)({
    props: {},
    req: { nextUrl: new URL("http://localhost/api/v1/management/contacts") },
    authentication: {
      type: "apiKey",
      apiKeyId: "apiKey123",
      organizationId: "org123",
      workspacePermissions: workspaceIds.map((workspaceId) => ({
        workspaceId,
        workspaceName: "Workspace",
        permission: "read",
      })),
    },
  });

// Decision 13: a key for one workspace with no contact directory gets the message, like the other
// contact routes; a key for several workspaces lists what their directories hold.
describe("GET /api/v1/management/contact-attributes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("answers 403 with the no-directory message for a key of one workspace with no directory", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({ contactDirectory: null } as never);

    const { response } = await get(["clws0000000000000000000001"]);

    expect(response.status).toBe(403);
    expect((await response.json()).message).toBe(CONTACT_DIRECTORY_MISSING_MESSAGE);
    expect(getContactAttributes).not.toHaveBeenCalled();
  });

  test("lists for a key of one workspace with a directory", async () => {
    vi.mocked(prisma.workspace.findUnique).mockResolvedValue({
      contactDirectory: { id: "cldir", matchingKey: "email" },
    } as never);

    const { response } = await get(["clws0000000000000000000001"]);

    expect(response.status).toBe(200);
    expect(getContactAttributes).toHaveBeenCalledWith(
      ["clws0000000000000000000001"],
      V1_MANAGEMENT_MAX_LIMIT,
      0
    );
  });

  test("lists for a key of several workspaces, whether or not each has a directory", async () => {
    const { response } = await get(["clws0000000000000000000001", "clws0000000000000000000002"]);

    expect(response.status).toBe(200);
    expect(prisma.workspace.findUnique).not.toHaveBeenCalled();
    expect(getContactAttributes).toHaveBeenCalledWith(
      ["clws0000000000000000000001", "clws0000000000000000000002"],
      V1_MANAGEMENT_MAX_LIMIT,
      0
    );
  });
});
