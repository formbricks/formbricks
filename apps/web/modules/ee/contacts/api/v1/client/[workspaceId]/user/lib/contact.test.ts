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

const workspaceId = "testWorkspaceId";
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
    vi.mocked(prisma.contact.findFirst, { partial: true }).mockResolvedValue(mockContactDbData);

    const contact = await getContactByUserIdWithAttributes(workspaceId, userId);

    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: {
        directory: { workspaces: { some: { id: workspaceId } } },
        attributes: {
          some: {
            attributeKey: { key: "userId", directory: { workspaces: { some: { id: workspaceId } } } },
            value: userId,
          },
        },
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

    const contact = await getContactByUserIdWithAttributes(workspaceId, userId);

    expect(prisma.contact.findFirst).toHaveBeenCalledWith({
      where: {
        directory: { workspaces: { some: { id: workspaceId } } },
        attributes: {
          some: {
            attributeKey: { key: "userId", directory: { workspaces: { some: { id: workspaceId } } } },
            value: userId,
          },
        },
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
