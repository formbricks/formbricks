import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getContactByUserId } from "./contact";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findFirst: vi.fn(),
    },
  },
}));

const mockEnvironmentId = "clxmg5n79000008l9df7b8nh8";
const mockUserId = "dpqs2axc6v3b5cjcgtnqhwov";
const mockContactId = "clxmg5n79000108l9df7b8xyz";

const mockReturnedContact = {
  id: mockContactId,
  environmentId: mockEnvironmentId,
  createdAt: new Date("2024-01-01T10:00:00.000Z"),
  updatedAt: new Date("2024-01-01T11:00:00.000Z"),
};

describe("getContactByUserId", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("should return contact if found", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockReturnedContact as any);

    const result = await getContactByUserId(mockEnvironmentId, mockUserId);

    expect(result).toEqual(mockReturnedContact);
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
    });
  });

  test("should return null if contact not found", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);

    const result = await getContactByUserId(mockEnvironmentId, mockUserId);

    expect(result).toBeNull();
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
    });
  });

  test("should call prisma.contact.findFirst with correct parameters", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockReturnedContact as any);
    await getContactByUserId(mockEnvironmentId, mockUserId);

    expect(prisma.contact.findFirst).toHaveBeenCalledTimes(1);
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
    });
  });
});
