import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getContactAttributes } from "./contact-attributes";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttribute: {
      findMany: vi.fn(),
    },
  },
}));

const mockEnvironmentId1 = "testEnvId1";
const mockEnvironmentId2 = "testEnvId2";
const mockEnvironmentIds = [mockEnvironmentId1, mockEnvironmentId2];

const mockContactAttributes = [
  {
    id: "attr1",
    value: "value1",
    attributeKeyId: "key1",
    contactId: "contact1",
    createdAt: new Date(),
    updatedAt: new Date(),
    attributeKey: {
      id: "key1",
      key: "attrKey1",
      name: "Attribute Key 1",
      description: "Description 1",
      environmentId: mockEnvironmentId1,
      isUnique: false,
      type: "custom",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
  {
    id: "attr2",
    value: "value2",
    attributeKeyId: "key2",
    contactId: "contact2",
    createdAt: new Date(),
    updatedAt: new Date(),
    attributeKey: {
      id: "key2",
      key: "attrKey2",
      name: "Attribute Key 2",
      description: "Description 2",
      environmentId: mockEnvironmentId2,
      isUnique: false,
      type: "custom",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  },
];

describe("getContactAttributes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should return contact attributes when found", async () => {
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue(mockContactAttributes as any);

    const result = await getContactAttributes(mockEnvironmentIds);

    expect(prisma.contactAttribute.findMany).toHaveBeenCalledWith({
      where: {
        attributeKey: {
          environmentId: { in: mockEnvironmentIds },
        },
      },
    });
    expect(result).toEqual(mockContactAttributes);
  });

  test("should throw DatabaseError when PrismaClientKnownRequestError occurs", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2001",
      clientVersion: "test",
    });
    vi.mocked(prisma.contactAttribute.findMany).mockRejectedValue(prismaError);

    await expect(getContactAttributes(mockEnvironmentIds)).rejects.toThrow(DatabaseError);
  });

  test("should throw generic error when an unknown error occurs", async () => {
    const genericError = new Error("Test Generic Error");
    vi.mocked(prisma.contactAttribute.findMany).mockRejectedValue(genericError);

    await expect(getContactAttributes(mockEnvironmentIds)).rejects.toThrow(genericError);
  });

  test("should return empty array when no contact attributes are found", async () => {
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);

    const result = await getContactAttributes(mockEnvironmentIds);

    expect(result).toEqual([]);
    expect(prisma.contactAttribute.findMany).toHaveBeenCalledWith({
      where: {
        attributeKey: {
          environmentId: { in: mockEnvironmentIds },
        },
      },
    });
  });
});
