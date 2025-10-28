import { describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TContactAttributes } from "@formbricks/types/contact-attribute";
import { getContactByUserId } from "../contact";

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
  environmentId,
  createdAt: new Date(),
  updatedAt: new Date(),
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
  test("should return ok result with contact and attributes when found", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactDbData);

    const result = await getContactByUserId(environmentId, userId);

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

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        id: contactId,
        attributes: expectedContactAttributes,
      });
    }
  });

  test("should return ok result with null when contact is not found", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(null);

    const result = await getContactByUserId(environmentId, userId);

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

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toBeNull();
    }
  });

  test("should return error result when database throws an error", async () => {
    const errorMessage = "Database connection failed";
    vi.mocked(prisma.contact.findFirst).mockRejectedValue(new Error(errorMessage));

    const result = await getContactByUserId(environmentId, userId);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toEqual({
        type: "internal_server_error",
        details: [{ field: "contact", issue: errorMessage }],
      });
    }
  });

  test("should correctly transform multiple attributes", async () => {
    const mockContactWithManyAttributes = {
      id: contactId,
      environmentId,
      createdAt: new Date(),
      updatedAt: new Date(),
      attributes: [
        { attributeKey: { key: "userId" }, value: "user123" },
        { attributeKey: { key: "email" }, value: "multi@example.com" },
        { attributeKey: { key: "firstName" }, value: "John" },
        { attributeKey: { key: "lastName" }, value: "Doe" },
        { attributeKey: { key: "company" }, value: "Acme Corp" },
      ],
    };

    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactWithManyAttributes);

    const result = await getContactByUserId(environmentId, userId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data?.attributes).toEqual({
        userId: "user123",
        email: "multi@example.com",
        firstName: "John",
        lastName: "Doe",
        company: "Acme Corp",
      });
    }
  });

  test("should handle contact with empty attributes array", async () => {
    const mockContactWithNoAttributes = {
      id: contactId,
      environmentId,
      createdAt: new Date(),
      updatedAt: new Date(),
      attributes: [],
    };

    vi.mocked(prisma.contact.findFirst).mockResolvedValue(mockContactWithNoAttributes);

    const result = await getContactByUserId(environmentId, userId);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({
        id: contactId,
        attributes: {},
      });
    }
  });
});
