import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getContactByUserIdWithAttributes } from "./contact";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findFirst: vi.fn(),
    },
  },
}));

const mockEnvironmentId = "testEnvironmentId";
const mockUserId = "testUserId";
const mockContactId = "testContactId";

describe("getContactByUserIdWithAttributes", () => {
  test("should return contact with filtered attributes when found", async () => {
    const mockUpdatedAttributes = { email: "new@example.com", plan: "premium" };
    const mockDbContact = {
      id: mockContactId,
      attributes: [
        { attributeKey: { key: "email" }, value: "new@example.com" },
        { attributeKey: { key: "plan" }, value: "premium" },
      ],
    };
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockDbContact as any);

    const result = await getContactByUserIdWithAttributes(
      mockEnvironmentId,
      mockUserId,
      mockUpdatedAttributes
    );

    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: {
        environmentId: mockEnvironmentId,
        attributes: {
          some: { attributeKey: { key: "userId", environmentId: mockEnvironmentId }, value: mockUserId },
        },
      },
      select: {
        id: true,
        attributes: {
          where: {
            attributeKey: {
              key: {
                in: Object.keys(mockUpdatedAttributes),
              },
            },
          },
          select: { attributeKey: { select: { key: true } }, value: true },
        },
      },
    });
    expect(result).toEqual(mockDbContact);
  });

  test("should return null if contact not found", async () => {
    const mockUpdatedAttributes = { email: "new@example.com" };
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);

    const result = await getContactByUserIdWithAttributes(
      mockEnvironmentId,
      mockUserId,
      mockUpdatedAttributes
    );

    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: {
        environmentId: mockEnvironmentId,
        attributes: {
          some: { attributeKey: { key: "userId", environmentId: mockEnvironmentId }, value: mockUserId },
        },
      },
      select: {
        id: true,
        attributes: {
          where: {
            attributeKey: {
              key: {
                in: Object.keys(mockUpdatedAttributes),
              },
            },
          },
          select: { attributeKey: { select: { key: true } }, value: true },
        },
      },
    });
    expect(result).toBeNull();
  });

  test("should handle empty updatedAttributes", async () => {
    const mockUpdatedAttributes = {};
    const mockDbContact = {
      id: mockContactId,
      attributes: [], // No attributes should be fetched if updatedAttributes is empty
    };
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockDbContact as any);

    const result = await getContactByUserIdWithAttributes(
      mockEnvironmentId,
      mockUserId,
      mockUpdatedAttributes
    );

    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: {
        environmentId: mockEnvironmentId,
        attributes: {
          some: { attributeKey: { key: "userId", environmentId: mockEnvironmentId }, value: mockUserId },
        },
      },
      select: {
        id: true,
        attributes: {
          where: {
            attributeKey: {
              key: {
                in: [], // Object.keys({}) results in an empty array
              },
            },
          },
          select: { attributeKey: { select: { key: true } }, value: true },
        },
      },
    });
    expect(result).toEqual(mockDbContact);
  });

  test("should return contact with only requested attributes even if DB stores more", async () => {
    const mockUpdatedAttributes = { email: "new@example.com" }; // only request email
    // The prisma call will filter attributes based on `Object.keys(mockUpdatedAttributes)`
    const mockPrismaResponse = {
      id: mockContactId,
      attributes: [{ attributeKey: { key: "email" }, value: "new@example.com" }],
    };
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockPrismaResponse as any);

    const result = await getContactByUserIdWithAttributes(
      mockEnvironmentId,
      mockUserId,
      mockUpdatedAttributes
    );

    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: {
        environmentId: mockEnvironmentId,
        attributes: {
          some: { attributeKey: { key: "userId", environmentId: mockEnvironmentId }, value: mockUserId },
        },
      },
      select: {
        id: true,
        attributes: {
          where: {
            attributeKey: {
              key: {
                in: ["email"],
              },
            },
          },
          select: { attributeKey: { select: { key: true } }, value: true },
        },
      },
    });
    expect(result).toEqual(mockPrismaResponse);
  });
});
