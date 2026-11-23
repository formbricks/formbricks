import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { DatabaseError } from "@formbricks/types/errors";
import { getContact } from "./contact";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("react", () => ({ cache: <T>(fn: T) => fn }));

const mockContactId = "eegeo7qmz9sn5z85fi76lg8o";
const mockContact = {
  id: mockContactId,
  createdAt: new Date(),
  updatedAt: new Date(),
  workspaceId: "workspace-1",
  directoryId: "directory-1",
};

describe("contact lib", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getContact", () => {
    test("returns the contact's v1 columns and its directory, which decides access", async () => {
      vi.mocked(prisma.contact.findUnique).mockResolvedValue(mockContact);

      const result = await getContact(mockContactId);

      expect(result).toEqual(mockContact);
      expect(prisma.contact.findUnique).toHaveBeenCalledWith({
        where: { id: mockContactId },
        select: { id: true, createdAt: true, updatedAt: true, workspaceId: true, directoryId: true },
      });
    });

    test("returns null if contact not found", async () => {
      vi.mocked(prisma.contact.findUnique).mockResolvedValue(null);

      await expect(getContact(mockContactId)).resolves.toBeNull();
    });

    test("throws DatabaseError if prisma throws PrismaClientKnownRequestError", async () => {
      vi.mocked(prisma.contact.findUnique).mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Test Prisma Error", { code: "P2025", clientVersion: "2.0" })
      );

      await expect(getContact(mockContactId)).rejects.toThrow(DatabaseError);
    });
  });
});
