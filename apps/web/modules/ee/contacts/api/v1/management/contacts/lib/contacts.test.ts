import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { getContacts } from "./contacts";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findMany: vi.fn(),
    },
    workspace: {
      findMany: vi.fn(),
    },
  },
}));
vi.mock("react", () => ({ cache: <T>(fn: T) => fn }));

const workspaceA = "ay70qluzic16hu8fu6xrqebq";
const workspaceB = "raeeymwqrn9iqwe5rp13vwem";
const createdAt = new Date("2024-01-01");
const updatedAt = new Date("2024-01-02");

describe("getContacts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("lists the contacts of the key's directories in the pinned v1 shape", async () => {
    // Both workspaces use one directory: each contact is listed once.
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      { id: workspaceA, contactDirectoryId: "dir-1" },
      { id: workspaceB, contactDirectoryId: "dir-1" },
    ] as never);
    vi.mocked(prisma.contact.findMany).mockResolvedValue([
      // A column a later release adds must not reach the response.
      { id: "c1", createdAt, updatedAt, workspaceId: workspaceB, directoryId: "dir-1", matchKey: "x" },
      { id: "c2", createdAt, updatedAt, workspaceId: null, directoryId: "dir-1" },
    ] as never);

    const result = await getContacts([workspaceB, workspaceA], 25, 50);

    expect(prisma.workspace.findMany).toHaveBeenCalledWith({
      where: { id: { in: [workspaceB, workspaceA] }, contactDirectoryId: { not: null } },
      select: { id: true, contactDirectoryId: true },
      orderBy: { id: "asc" },
    });
    expect(prisma.contact.findMany).toHaveBeenCalledWith({
      where: { directoryId: { in: ["dir-1"] } },
      select: { id: true, createdAt: true, updatedAt: true, workspaceId: true, directoryId: true },
      orderBy: { id: "asc" },
      take: 25,
      skip: 50,
    });
    expect(result).toStrictEqual([
      // The origin workspace when it still exists…
      { id: "c1", createdAt, updatedAt, workspaceId: workspaceB },
      // …else the caller's workspace on the directory with the lowest id.
      { id: "c2", createdAt, updatedAt, workspaceId: workspaceA },
    ]);
    expect(Object.keys(result[0]).sort()).toEqual(["createdAt", "id", "updatedAt", "workspaceId"]);
  });

  test("returns nothing, without reading contacts, when no workspace has a directory", async () => {
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([]);

    await expect(getContacts([workspaceA], 25, 50)).resolves.toEqual([]);
    expect(prisma.contact.findMany).not.toHaveBeenCalled();
  });

  test("should throw DatabaseError on PrismaClientKnownRequestError", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2002",
      clientVersion: "2.0.0",
    });
    vi.mocked(prisma.workspace.findMany).mockResolvedValue([
      { id: workspaceA, contactDirectoryId: "dir-1" },
    ] as never);
    vi.mocked(prisma.contact.findMany).mockRejectedValue(prismaError);

    await expect(getContacts([workspaceA], 25, 50)).rejects.toThrow(DatabaseError);
  });

  test("should throw original error for other errors", async () => {
    const genericError = new Error("Test Generic Error");
    vi.mocked(prisma.workspace.findMany).mockRejectedValue(genericError);

    await expect(getContacts([workspaceA], 25, 50)).rejects.toThrow(genericError);
  });
});
