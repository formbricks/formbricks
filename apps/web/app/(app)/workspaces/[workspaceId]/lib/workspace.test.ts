import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { lookupAuthorizedWorkspaceIds } from "@/lib/authorization/resource-list";
import { getWorkspacesByUserId, getWritableWorkspacesByUserId } from "./workspace";

vi.mock("@formbricks/database", () => ({
  prisma: { workspace: { findMany: vi.fn() } },
}));
vi.mock("@/lib/authorization/resource-list", () => ({ lookupAuthorizedWorkspaceIds: vi.fn() }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue(["workspace1", "workspace2"]);
});

describe("authoritative workspace switcher lists", () => {
  test("resolves readable workspaces through SpiceDB and scopes the data query to the organization", async () => {
    const workspaces = [
      { id: "workspace1", name: "Workspace 1" },
      { id: "workspace2", name: "Workspace 2" },
    ];
    vi.mocked(prisma.workspace.findMany).mockResolvedValue(workspaces as never);

    await expect(getWorkspacesByUserId("user1", "org1")).resolves.toEqual(workspaces);

    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledExactlyOnceWith(
      { id: "user1", type: "user" },
      "read"
    );
    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true },
      where: { id: { in: ["workspace1", "workspace2"] }, organizationId: "org1" },
    });
  });

  test("uses workspace.write for writable destination lists", async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);

    await expect(getWritableWorkspacesByUserId("user1", "org1")).resolves.toEqual([]);

    expect(lookupAuthorizedWorkspaceIds).toHaveBeenCalledExactlyOnceWith(
      { id: "user1", type: "user" },
      "write"
    );
  });

  test("does not query PostgreSQL when SpiceDB returns no workspaces", async () => {
    vi.mocked(lookupAuthorizedWorkspaceIds).mockResolvedValue([]);

    await expect(getWorkspacesByUserId("user1", "org1")).resolves.toEqual([]);

    expect(prisma.workspace.findMany).not.toHaveBeenCalled();
  });

  test("translates Prisma failures without converting them into an empty list", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Database error", {
      clientVersion: "5.0.0",
      code: "P2002",
    });
    vi.mocked(prisma.workspace.findMany).mockRejectedValue(prismaError);

    await expect(getWorkspacesByUserId("user1", "org1")).rejects.toBeInstanceOf(DatabaseError);
  });

  test("propagates AuthZed lookup failures", async () => {
    const unavailable = new Error("AuthZed unavailable");
    vi.mocked(lookupAuthorizedWorkspaceIds).mockRejectedValue(unavailable);

    await expect(getWorkspacesByUserId("user1", "org1")).rejects.toBe(unavailable);
  });

  test("validates actor and organization inputs before authorization lookup", async () => {
    await expect(getWorkspacesByUserId(123 as never, "org1")).rejects.toThrow();
    await expect(getWorkspacesByUserId("user1", {} as never)).rejects.toThrow();
    expect(lookupAuthorizedWorkspaceIds).not.toHaveBeenCalled();
  });
});
