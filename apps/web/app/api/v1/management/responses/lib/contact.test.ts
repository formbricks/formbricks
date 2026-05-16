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

const workspaceId = "test-workspace-id";
const userId = "test-user-id";
const contactId = "test-contact-id";

const mockContactDbData = {
  id: contactId,
  createdAt: new Date(),
  updatedAt: new Date(),
  workspaceId,
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
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(
      mockContactDbData as unknown as Awaited<ReturnType<typeof prisma.contact.findFirst>>
    );

    const contact = await getContactByUserId(workspaceId, userId);

    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: {
        attributes: {
          some: {
            attributeKey: {
              key: "userId",
              workspaceId,
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

    const contact = await getContactByUserId(workspaceId, userId);

    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: {
        attributes: {
          some: {
            attributeKey: {
              key: "userId",
              workspaceId,
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
