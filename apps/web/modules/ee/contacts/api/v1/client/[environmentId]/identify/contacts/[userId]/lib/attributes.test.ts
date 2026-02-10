import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { ValidationError } from "@formbricks/types/errors";
import { getContactAttributes } from "./attributes";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttribute: {
      findMany: vi.fn(),
    },
  },
}));

const mockContactId = "xn8b8ol97q2pcp8dnlpsfs1m";
const mockAttributeKeyId = "cmlg3j70w00002e6hxs5mpkuu";

describe("getContactAttributes", () => {
  test("should return transformed attributes when found", async () => {
    const mockContactAttributes = [
      {
        id: "ca1",
        createdAt: new Date(),
        updatedAt: new Date(),
        attributeKeyId: mockAttributeKeyId,
        contactId: mockContactId,
        attributeKey: { key: "email", dataType: "string" },
        value: "test@example.com",
        valueNumber: null,
        valueDate: null,
      },
      {
        id: "ca2",
        createdAt: new Date(),
        updatedAt: new Date(),
        attributeKeyId: mockAttributeKeyId,
        contactId: mockContactId,
        attributeKey: { key: "name", dataType: "string" },
        value: "Test User",
        valueNumber: null,
        valueDate: null,
      },
    ];
    const expectedTransformedAttributes = {
      email: "test@example.com",
      name: "Test User",
    };

    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue(mockContactAttributes);

    const result = await getContactAttributes(mockContactId);

    expect(result).toEqual(expectedTransformedAttributes);
    expect(prisma.contactAttribute.findMany).toHaveBeenCalledWith({
      where: {
        contactId: mockContactId,
      },
      select: {
        value: true,
        valueNumber: true,
        valueDate: true,
        attributeKey: { select: { key: true, dataType: true } },
      },
    });
  });

  test("should return an empty object when no attributes are found", async () => {
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);

    const result = await getContactAttributes(mockContactId);

    expect(result).toEqual({});
    expect(prisma.contactAttribute.findMany).toHaveBeenCalledWith({
      where: {
        contactId: mockContactId,
      },
      select: {
        value: true,
        valueNumber: true,
        valueDate: true,
        attributeKey: { select: { key: true, dataType: true } },
      },
    });
  });

  test("should throw a ValidationError when contactId is invalid", async () => {
    const invalidContactId = "hello-world";

    await expect(getContactAttributes(invalidContactId)).rejects.toThrowError(ValidationError);
  });
});
