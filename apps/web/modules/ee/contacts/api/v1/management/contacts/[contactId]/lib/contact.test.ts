import { contactCache } from "@/lib/cache/contact";
import { Contact, Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { deleteContact, getContact } from "./contact";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findUnique: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

vi.mock("@/lib/cache/contact", () => ({
  contactCache: {
    revalidate: vi.fn(),
    tag: {
      byId: vi.fn((id) => `contact-${id}`),
    },
  },
}));

const mockContactId = "eegeo7qmz9sn5z85fi76lg8o";
const mockEnvironmentId = "sv7jqr9qjmayp1hc6xm7rfud";
const mockContact = {
  id: mockContactId,
  environmentId: mockEnvironmentId,
  createdAt: new Date(),
  updatedAt: new Date(),
  attributes: [],
};

describe("contact lib", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getContact", () => {
    test("should return contact if found", async () => {
      vi.mocked(prisma.contact.findUnique).mockResolvedValue(mockContact);
      const result = await getContact(mockContactId);

      expect(result).toEqual(mockContact);
      expect(prisma.contact.findUnique).toHaveBeenCalledWith({ where: { id: mockContactId } });
      expect(contactCache.tag.byId).toHaveBeenCalledWith(mockContactId);
    });

    test("should return null if contact not found", async () => {
      vi.mocked(prisma.contact.findUnique).mockResolvedValue(null);
      const result = await getContact(mockContactId);

      expect(result).toBeNull();
      expect(prisma.contact.findUnique).toHaveBeenCalledWith({ where: { id: mockContactId } });
    });

    test("should throw DatabaseError if prisma throws PrismaClientKnownRequestError", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2001",
        clientVersion: "2.0.0",
      });
      vi.mocked(prisma.contact.findUnique).mockRejectedValue(prismaError);

      await expect(getContact(mockContactId)).rejects.toThrow(DatabaseError);
    });

    test("should throw error for other errors", async () => {
      const genericError = new Error("Test Generic Error");
      vi.mocked(prisma.contact.findUnique).mockRejectedValue(genericError);

      await expect(getContact(mockContactId)).rejects.toThrow(genericError);
    });
  });

  describe("deleteContact", () => {
    const mockDeletedContact = {
      id: mockContactId,
      environmentId: mockEnvironmentId,
      attributes: [{ attributeKey: { key: "email" }, value: "test@example.com" }],
    } as unknown as Contact;

    const mockDeletedContactWithUserId = {
      id: mockContactId,
      environmentId: mockEnvironmentId,
      attributes: [
        { attributeKey: { key: "email" }, value: "test@example.com" },
        { attributeKey: { key: "userId" }, value: "user123" },
      ],
    } as unknown as Contact;

    test("should delete contact and revalidate cache", async () => {
      vi.mocked(prisma.contact.delete).mockResolvedValue(mockDeletedContact);
      await deleteContact(mockContactId);

      expect(prisma.contact.delete).toHaveBeenCalledWith({
        where: { id: mockContactId },
        select: {
          id: true,
          environmentId: true,
          attributes: { select: { attributeKey: { select: { key: true } }, value: true } },
        },
      });
      expect(contactCache.revalidate).toHaveBeenCalledWith({
        id: mockContactId,
        userId: undefined,
        environmentId: mockEnvironmentId,
      });
    });

    test("should delete contact and revalidate cache with userId", async () => {
      vi.mocked(prisma.contact.delete).mockResolvedValue(mockDeletedContactWithUserId);
      await deleteContact(mockContactId);

      expect(prisma.contact.delete).toHaveBeenCalledWith({
        where: { id: mockContactId },
        select: {
          id: true,
          environmentId: true,
          attributes: { select: { attributeKey: { select: { key: true } }, value: true } },
        },
      });
      expect(contactCache.revalidate).toHaveBeenCalledWith({
        id: mockContactId,
        userId: "user123",
        environmentId: mockEnvironmentId,
      });
    });

    test("should throw DatabaseError if prisma throws PrismaClientKnownRequestError", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2001",
        clientVersion: "2.0.0",
      });
      vi.mocked(prisma.contact.delete).mockRejectedValue(prismaError);

      await expect(deleteContact(mockContactId)).rejects.toThrow(DatabaseError);
    });

    test("should throw error for other errors", async () => {
      const genericError = new Error("Test Generic Error");
      vi.mocked(prisma.contact.delete).mockRejectedValue(genericError);

      await expect(deleteContact(mockContactId)).rejects.toThrow(genericError);
    });
  });
});
