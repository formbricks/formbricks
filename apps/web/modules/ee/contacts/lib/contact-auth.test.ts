import { notFound } from "next/navigation";
import { Mocked, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { getWorkspaceAuth } from "@/modules/workspaces/lib/utils";
import { TWorkspaceAuth } from "@/modules/workspaces/types/workspace-auth";
import { getContactAuth } from "./contact-auth";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@formbricks/logger", () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("next/navigation", () => ({
  notFound: vi.fn(() => {
    throw new Error("NEXT_NOT_FOUND");
  }),
}));

vi.mock("@/modules/workspaces/lib/utils", () => ({
  getWorkspaceAuth: vi.fn(),
}));

// reactCache(fn) returns fn, which is then invoked
vi.mock("react", () => ({
  cache: vi.fn((fn) => fn),
}));

const mockPrismaContact = prisma.contact as Mocked<typeof prisma.contact>;
const mockGetWorkspaceAuth = vi.mocked(getWorkspaceAuth);

const ATTACKER_WORKSPACE_ID = "workspace_attacker";
const VICTIM_WORKSPACE_ID = "workspace_victim";
const CONTACT_ID = "contact_victim";

const buildWorkspaceAuth = (workspaceId: string) =>
  ({ workspace: { id: workspaceId }, isOwner: true }) as unknown as TWorkspaceAuth;

describe("getContactAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns the workspace authorization when the contact belongs to the workspace", async () => {
    mockGetWorkspaceAuth.mockResolvedValueOnce(buildWorkspaceAuth(VICTIM_WORKSPACE_ID));
    mockPrismaContact.findUnique.mockResolvedValueOnce({ workspaceId: VICTIM_WORKSPACE_ID } as any);

    const auth = await getContactAuth(VICTIM_WORKSPACE_ID, CONTACT_ID);

    expect(auth.workspace.id).toBe(VICTIM_WORKSPACE_ID);
    expect(notFound).not.toHaveBeenCalled();
    // The contact lookup stays narrow — it exists to place the contact in a workspace, nothing else.
    expect(mockPrismaContact.findUnique).toHaveBeenCalledWith({
      where: { id: CONTACT_ID },
      select: { workspaceId: true },
    });
  });

  test("404s when the caller pairs their own workspace with a foreign contact", async () => {
    // The cross-tenant read: authorization for the attacker's own workspace succeeds, but the
    // contact in the URL belongs to someone else.
    mockGetWorkspaceAuth.mockResolvedValueOnce(buildWorkspaceAuth(ATTACKER_WORKSPACE_ID));
    mockPrismaContact.findUnique.mockResolvedValueOnce({ workspaceId: VICTIM_WORKSPACE_ID } as any);

    await expect(getContactAuth(ATTACKER_WORKSPACE_ID, CONTACT_ID)).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalled();
  });

  test("404s when the contact does not exist, so a foreign id is indistinguishable", async () => {
    mockGetWorkspaceAuth.mockResolvedValueOnce(buildWorkspaceAuth(ATTACKER_WORKSPACE_ID));
    mockPrismaContact.findUnique.mockResolvedValueOnce(null);

    await expect(getContactAuth(ATTACKER_WORKSPACE_ID, "contact_missing")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  test("propagates the workspace authorization failure instead of masking it as a 404", async () => {
    mockGetWorkspaceAuth.mockRejectedValueOnce(new Error("not authorized"));
    mockPrismaContact.findUnique.mockResolvedValueOnce({ workspaceId: VICTIM_WORKSPACE_ID } as any);

    await expect(getContactAuth(VICTIM_WORKSPACE_ID, CONTACT_ID)).rejects.toThrow("not authorized");
  });

  test("wraps a Prisma failure of the contact lookup in a DatabaseError", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("DB Error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    mockGetWorkspaceAuth.mockResolvedValueOnce(buildWorkspaceAuth(VICTIM_WORKSPACE_ID));
    mockPrismaContact.findUnique.mockRejectedValueOnce(prismaError);

    await expect(getContactAuth(VICTIM_WORKSPACE_ID, CONTACT_ID)).rejects.toThrow(DatabaseError);
  });

  test("re-throws a non-Prisma failure of the contact lookup unchanged", async () => {
    const error = new Error("Unknown error");
    mockGetWorkspaceAuth.mockResolvedValueOnce(buildWorkspaceAuth(VICTIM_WORKSPACE_ID));
    mockPrismaContact.findUnique.mockRejectedValueOnce(error);

    await expect(getContactAuth(VICTIM_WORKSPACE_ID, CONTACT_ID)).rejects.toThrow(error);
  });
});
