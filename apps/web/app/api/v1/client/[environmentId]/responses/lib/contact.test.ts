import { cache } from "@/lib/cache";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getContact, getContactByUserId } from "./contact";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

// Mock cache module
vi.mock("@/lib/cache");

// Mock react cache
vi.mock("react", async () => {
  const actual = await vi.importActual("react");
  return {
    ...actual,
    cache: vi.fn((fn) => fn), // Mock react's cache to just return the function
  };
});

const mockContactId = "test-contact-id";
const mockEnvironmentId = "test-env-id";
const mockUserId = "test-user-id";

describe("Contact API Lib", () => {
  beforeEach(() => {
    vi.mocked(cache).mockImplementation((fn) => async () => {
      return fn();
    });
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("getContact", () => {
    test("should return contact if found", async () => {
      const mockContactData = { id: mockContactId };
      vi.mocked(prisma.contact.findUnique).mockResolvedValue(mockContactData);

      const contact = await getContact(mockContactId);

      expect(prisma.contact.findUnique).toHaveBeenCalledWith({
        where: { id: mockContactId },
        select: { id: true },
      });
      expect(contact).toEqual(mockContactData);
    });

    test("should return null if contact not found", async () => {
      vi.mocked(prisma.contact.findUnique).mockResolvedValue(null);

      const contact = await getContact(mockContactId);

      expect(prisma.contact.findUnique).toHaveBeenCalledWith({
        where: { id: mockContactId },
        select: { id: true },
      });
      expect(contact).toBeNull();
    });

    test("should throw DatabaseError on Prisma error", async () => {
      const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
        code: "P2025",
        clientVersion: "5.0.0",
      });
      vi.mocked(prisma.contact.findUnique).mockRejectedValue(prismaError);

      await expect(getContact(mockContactId)).rejects.toThrow(DatabaseError);
      expect(prisma.contact.findUnique).toHaveBeenCalledWith({
        where: { id: mockContactId },
        select: { id: true },
      });
    });
  });

  describe("getContactByUserId", () => {
    test("should return contact with formatted attributes if found", async () => {
      const mockContactData = {
        id: mockContactId,
        attributes: [
          { attributeKey: { key: "userId" }, value: mockUserId },
          { attributeKey: { key: "email" }, value: "test@example.com" },
        ],
      };
      vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactData);

      const contact = await getContactByUserId(mockEnvironmentId, mockUserId);

      expect(prisma.contact.findFirst).toHaveBeenCalledWith({
        where: {
          attributes: {
            some: {
              attributeKey: {
                key: "userId",
                environmentId: mockEnvironmentId,
              },
              value: mockUserId,
            },
          },
        },
        select: {
          id: true,
          attributes: {
            select: {
              attributeKey: { select: { key: true } },
              value: true,
            },
          },
        },
      });
      expect(contact).toEqual({
        id: mockContactId,
        attributes: {
          userId: mockUserId,
          email: "test@example.com",
        },
      });
    });

    test("should return null if contact not found by userId", async () => {
      vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);

      const contact = await getContactByUserId(mockEnvironmentId, mockUserId);

      expect(prisma.contact.findFirst).toHaveBeenCalledWith({
        where: {
          attributes: {
            some: {
              attributeKey: {
                key: "userId",
                environmentId: mockEnvironmentId,
              },
              value: mockUserId,
            },
          },
        },
        select: {
          id: true,
          attributes: {
            select: {
              attributeKey: { select: { key: true } },
              value: true,
            },
          },
        },
      });
      expect(contact).toBeNull();
    });
  });
});
