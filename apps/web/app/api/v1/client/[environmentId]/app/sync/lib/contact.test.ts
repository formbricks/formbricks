import { TContact } from "@/modules/ee/contacts/types/contact";
import { afterEach, describe, expect, test, vi } from "vitest";
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

const environmentId = "test-environment-id";
const userId = "test-user-id";
const contactId = "test-contact-id";

const contactMock: Partial<TContact> & {
  attributes: { value: string; attributeKey: { key: string } }[];
} = {
  id: contactId,
  attributes: [
    { attributeKey: { key: "userId" }, value: userId },
    { attributeKey: { key: "email" }, value: "test@example.com" },
  ],
};

describe("getContactByUserId", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test("should return contact if found", async () => {
    vi.mocked(prisma.contact.findFirst).mockResolvedValue(contactMock as any);

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
        attributes: { select: { attributeKey: { select: { key: true } }, value: true } },
      },
    });
    expect(contact).toEqual(contactMock);
  });

  test("should return null if contact not found", async () => {
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
        attributes: { select: { attributeKey: { select: { key: true } }, value: true } },
      },
    });
    expect(contact).toBeNull();
  });
});
