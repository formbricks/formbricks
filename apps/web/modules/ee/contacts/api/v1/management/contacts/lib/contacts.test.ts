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
  },
}));

const mockWorkspaceId1 = "ay70qluzic16hu8fu6xrqebq";
const mockWorkspaceId2 = "raeeymwqrn9iqwe5rp13vwem";
const mockWorkspaceIds = [mockWorkspaceId1, mockWorkspaceId2];

const mockContacts = [
  {
    id: "contactId1",
    workspaceId: mockWorkspaceId1,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "contactId2",
    workspaceId: mockWorkspaceId2,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("getContacts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should return contacts for given workspaceIds", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue(mockContacts);

    const result = await getContacts(mockWorkspaceIds);

    expect(prisma.contact.findMany).toHaveBeenCalledWith({
      where: { workspaceId: { in: mockWorkspaceIds } },
    });
    expect(result).toEqual(mockContacts);
  });

  test("should throw DatabaseError on PrismaClientKnownRequestError", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2002",
      clientVersion: "2.0.0",
    });
    vi.mocked(prisma.contact.findMany).mockRejectedValue(prismaError);

    await expect(getContacts(mockWorkspaceIds)).rejects.toThrow(DatabaseError);
    expect(prisma.contact.findMany).toHaveBeenCalledWith({
      where: { workspaceId: { in: mockWorkspaceIds } },
    });
  });

  test("should throw original error for other errors", async () => {
    const genericError = new Error("Test Generic Error");
    vi.mocked(prisma.contact.findMany).mockRejectedValue(genericError);

    await expect(getContacts(mockWorkspaceIds)).rejects.toThrow(genericError);
    expect(prisma.contact.findMany).toHaveBeenCalledWith({
      where: { workspaceId: { in: mockWorkspaceIds } },
    });
  });
});
