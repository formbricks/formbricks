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

vi.mock("@/lib/cache/contact-attribute", () => ({
  contactAttributeCache: {
    tag: {
      byContactId: vi.fn((contactId) => `contact-${contactId}-contactAttributes`),
    },
  },
}));

const mockContactId = "xn8b8ol97q2pcp8dnlpsfs1m";

describe("getContactAttributes", () => {
  test("should return transformed attributes when found", async () => {
    const mockContactAttributes = [
      { attributeKey: { key: "email" }, value: "test@example.com" },
      { attributeKey: { key: "name" }, value: "Test User" },
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
      select: { attributeKey: { select: { key: true } }, value: true },
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
      select: { attributeKey: { select: { key: true } }, value: true },
    });
  });

  test("should throw a ValidationError when contactId is invalid", async () => {
    const invalidContactId = "hello-world";

    await expect(getContactAttributes(invalidContactId)).rejects.toThrowError(ValidationError);
  });
});
