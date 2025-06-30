import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { getContactByUserId } from "./contact";

// Mock prisma
vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findFirst: vi.fn(),
    },
  },
}));

const environmentId = "test-env-id";
const userId = "test-user-id";
const contactId = "test-contact-id";

const mockContactDbData = {
  id: contactId,
  attributes: [
    { attributeKey: { key: "userId" }, value: userId },
    { attributeKey: { key: "email" }, value: "test@example.com" },
    { attributeKey: { key: "plan" }, value: "premium" },
  ],
};

const expectedContactAttributes: TContactAttributes = {
  userId: userId,
  email: "test@example.com",
  plan: "premium",
};

describe("getContactByUserId", () => {
  test("should return contact with attributes when found", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactDbData);

    const contact = await getContactByUserId(environmentId, userId);

    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: {
        attributes: {
          some: {
            attributeKey: {
              key: "userId",
              environmentId,
            },
            value: userId,
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
      id: contactId,
      attributes: expectedContactAttributes,
    });
  });

  test("should return null when contact is not found", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);

    const contact = await getContactByUserId(environmentId, userId);

    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: {
        attributes: {
          some: {
            attributeKey: {
              key: "userId",
              environmentId,
            },
            value: userId,
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
