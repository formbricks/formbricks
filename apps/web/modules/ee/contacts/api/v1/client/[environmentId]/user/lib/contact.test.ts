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

const environmentId = "testEnvironmentId";
const userId = "testUserId";

const mockContactDbData = {
  id: "contactId123",
  attributes: [
    { attributeKey: { key: "userId" }, value: userId },
    { attributeKey: { key: "email" }, value: "test@example.com" },
  ],
};

describe("getContactByUserIdWithAttributes", () => {
  test("should return contact with attributes when found", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactDbData);

    const contact = await getContactByUserIdWithAttributes(environmentId, userId);

    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: {
        environmentId,
        attributes: { some: { attributeKey: { key: "userId", environmentId }, value: userId } },
      },
      select: {
        id: true,
        attributes: {
          select: { attributeKey: { select: { key: true } }, value: true },
        },
      },
    });

    expect(contact).toEqual({
      id: "contactId123",
      attributes: [
        {
          attributeKey: { key: "userId" },
          value: userId,
        },
        {
          attributeKey: { key: "email" },
          value: "test@example.com",
        },
      ],
    });
  });

  test("should return null when contact not found", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);

    const contact = await getContactByUserIdWithAttributes(environmentId, userId);

    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: {
        environmentId,
        attributes: { some: { attributeKey: { key: "userId", environmentId }, value: userId } },
      },
      select: {
        id: true,
        attributes: {
          select: { attributeKey: { select: { key: true } }, value: true },
        },
      },
    });

    expect(contact).toBeNull();
  });
});
