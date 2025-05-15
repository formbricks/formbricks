import { contactCache } from "@/lib/cache/contact";
import { Prisma } from "@prisma/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError } from "@formbricks/types/errors";
import { getContacts } from "./contacts";

vi.mock("@/lib/cache/contact", () => ({
  contactCache: {
    tag: {
      byEnvironmentId: vi.fn((id) => `contact-environment-${id}`),
    },
  },
}));

vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findMany: vi.fn(),
    },
  },
}));

const mockEnvironmentId1 = "ay70qluzic16hu8fu6xrqebq";
const mockEnvironmentId2 = "raeeymwqrn9iqwe5rp13vwem";
const mockEnvironmentIds = [mockEnvironmentId1, mockEnvironmentId2];

const mockContacts = [
  {
    id: "contactId1",
    environmentId: mockEnvironmentId1,
    name: "Contact 1",
    email: "contact1@example.com",
    attributes: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: "contactId2",
    environmentId: mockEnvironmentId2,
    name: "Contact 2",
    email: "contact2@example.com",
    attributes: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

describe("getContacts", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("should return contacts for given environmentIds", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue(mockContacts);

    const result = await getContacts(mockEnvironmentIds);

    expect(prisma.contact.findMany).toHaveBeenCalledWith({
      where: { environmentId: { in: mockEnvironmentIds } },
    });
    expect(result).toEqual(mockContacts);
    expect(contactCache.tag.byEnvironmentId).toHaveBeenCalledWith(mockEnvironmentId1);
    expect(contactCache.tag.byEnvironmentId).toHaveBeenCalledWith(mockEnvironmentId2);
  });

  test("should throw DatabaseError on PrismaClientKnownRequestError", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test Prisma Error", {
      code: "P2002",
      clientVersion: "2.0.0",
    });
    vi.mocked(prisma.contact.findMany).mockRejectedValue(prismaError);

    await expect(getContacts(mockEnvironmentIds)).rejects.toThrow(DatabaseError);
    expect(prisma.contact.findMany).toHaveBeenCalledWith({
      where: { environmentId: { in: mockEnvironmentIds } },
    });
  });

  test("should throw original error for other errors", async () => {
    const genericError = new Error("Test Generic Error");
    vi.mocked(prisma.contact.findMany).mockRejectedValue(genericError);

    await expect(getContacts(mockEnvironmentIds)).rejects.toThrow(genericError);
    expect(prisma.contact.findMany).toHaveBeenCalledWith({
      where: { environmentId: { in: mockEnvironmentIds } },
    });
  });

  test("should use cache with correct tags", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue(mockContacts);

    await getContacts(mockEnvironmentIds);
  });
});
