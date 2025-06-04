import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { getContact } from "./contact";

// Mock dependencies
vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findUnique: vi.fn(),
    },
  },
}));

const contactId = "test-contact-id";
const mockContact = {
  id: contactId,
  attributes: [
    { attributeKey: { key: "email" }, value: "test@example.com" },
    { attributeKey: { key: "name" }, value: "Test User" },
  ],
};

const expectedContactAttributes: TContactAttributes = {
  email: "test@example.com",
  name: "Test User",
};

describe("getContact", () => {
  test("should return contact with formatted attributes when found", async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValue(mockContact);

    const result = await getContact(contactId);

    expect(prisma.contact.findUnique).toHaveBeenCalledWith({
      where: { id: contactId },
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
    expect(result).toEqual({
      id: contactId,
      attributes: expectedContactAttributes,
    });
  });

  test("should return null when contact is not found", async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValue(null);

    const result = await getContact(contactId);

    expect(prisma.contact.findUnique).toHaveBeenCalledWith({
      where: { id: contactId },
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
    expect(result).toBeNull();
  });
});
