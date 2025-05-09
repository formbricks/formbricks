import { Contact, Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { DatabaseError, ValidationError } from "@formbricks/types/errors";
import {
  buildContactWhereClause,
  createContactsFromCSV,
  deleteContact,
  getContact,
  getContacts,
} from "./contacts";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contact: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    contactAttribute: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
    contactAttributeKey: {
      findMany: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/cache", () => ({ cache: (fn) => fn }));
vi.mock("@/lib/cache/contact", () => ({
  contactCache: {
    revalidate: vi.fn(),
    tag: { byEnvironmentId: (env) => `env-${env}`, byId: (id) => `id-${id}` },
  },
}));
vi.mock("@/lib/cache/contact-attribute", () => ({
  contactAttributeCache: { revalidate: vi.fn() },
}));
vi.mock("@/lib/cache/contact-attribute-key", () => ({
  contactAttributeKeyCache: { revalidate: vi.fn() },
}));
vi.mock("@/lib/constants", () => ({ ITEMS_PER_PAGE: 2 }));
vi.mock("react", () => ({ cache: (fn) => fn }));

const environmentId = "env1";
const contactId = "contact1";
const userId = "user1";
const mockContact: Contact & {
  attributes: { value: string; attributeKey: { key: string; name: string } }[];
} = {
  id: contactId,
  createdAt: new Date(),
  updatedAt: new Date(),
  environmentId,
  userId,
  attributes: [
    { value: "john@example.com", attributeKey: { key: "email", name: "Email" } },
    { value: "John", attributeKey: { key: "name", name: "Name" } },
    { value: userId, attributeKey: { key: "userId", name: "User ID" } },
  ],
};

describe("getContacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns contacts with attributes", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([mockContact]);
    const result = await getContacts(environmentId, 0, "");
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].id).toBe(contactId);
    expect(result[0].attributes.email).toBe("john@example.com");
  });

  test("returns empty array if no contacts", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([]);
    const result = await getContacts(environmentId, 0, "");
    expect(result).toEqual([]);
  });

  test("throws DatabaseError on Prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.contact.findMany).mockRejectedValue(prismaError);
    await expect(getContacts(environmentId, 0, "")).rejects.toThrow(DatabaseError);
  });

  test("throws original error on unknown error", async () => {
    const genericError = new Error("Unknown error");
    vi.mocked(prisma.contact.findMany).mockRejectedValue(genericError);
    await expect(getContacts(environmentId, 0, "")).rejects.toThrow(genericError);
  });
});

describe("getContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns contact if found", async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValue(mockContact);
    const result = await getContact(contactId);
    expect(result).toEqual(mockContact);
  });

  test("returns null if not found", async () => {
    vi.mocked(prisma.contact.findUnique).mockResolvedValue(null);
    const result = await getContact(contactId);
    expect(result).toBeNull();
  });

  test("throws DatabaseError on Prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.contact.findUnique).mockRejectedValue(prismaError);
    await expect(getContact(contactId)).rejects.toThrow(DatabaseError);
  });

  test("throws original error on unknown error", async () => {
    const genericError = new Error("Unknown error");
    vi.mocked(prisma.contact.findUnique).mockRejectedValue(genericError);
    await expect(getContact(contactId)).rejects.toThrow(genericError);
  });
});

describe("deleteContact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("deletes contact and revalidates caches", async () => {
    vi.mocked(prisma.contact.delete).mockResolvedValue(mockContact);
    const result = await deleteContact(contactId);
    expect(result).toEqual(mockContact);
  });

  test("throws DatabaseError on Prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.contact.delete).mockRejectedValue(prismaError);
    await expect(deleteContact(contactId)).rejects.toThrow(DatabaseError);
  });

  test("throws original error on unknown error", async () => {
    const genericError = new Error("Unknown error");
    vi.mocked(prisma.contact.delete).mockRejectedValue(genericError);
    await expect(deleteContact(contactId)).rejects.toThrow(genericError);
  });
});

describe("createContactsFromCSV", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("creates new contacts and missing attribute keys", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contactAttributeKey.findMany)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        { key: "email", id: "id-email" },
        { key: "name", id: "id-name" },
      ]);
    vi.mocked(prisma.contactAttributeKey.createMany).mockResolvedValue({ count: 2 });
    vi.mocked(prisma.contact.create).mockResolvedValue({
      id: "c1",
      environmentId,
      createdAt: new Date(),
      updatedAt: new Date(),
      attributes: [
        { attributeKey: { key: "email" }, value: "john@example.com" },
        { attributeKey: { key: "name" }, value: "John" },
      ],
    } as any);
    const csvData = [{ email: "john@example.com", name: "John" }];
    const result = await createContactsFromCSV(csvData, environmentId, "skip", {
      email: "email",
      name: "name",
    });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0].id).toBe("c1");
  });

  test("skips duplicate contact with 'skip' action", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([
      { id: "c1", attributes: [{ attributeKey: { key: "email" }, value: "john@example.com" }] },
    ]);
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
      { key: "email", id: "id-email" },
      { key: "name", id: "id-name" },
    ]);
    const csvData = [{ email: "john@example.com", name: "John" }];
    const result = await createContactsFromCSV(csvData, environmentId, "skip", {
      email: "email",
      name: "name",
    });
    expect(result).toEqual([]);
  });

  test("updates contact with 'update' action", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([
      {
        id: "c1",
        attributes: [
          { attributeKey: { key: "email" }, value: "john@example.com" },
          { attributeKey: { key: "name" }, value: "Old" },
        ],
      },
    ]);
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
      { key: "email", id: "id-email" },
      { key: "name", id: "id-name" },
    ]);
    vi.mocked(prisma.contact.update).mockResolvedValue({
      id: "c1",
      environmentId,
      createdAt: new Date(),
      updatedAt: new Date(),
      attributes: [
        { attributeKey: { key: "email" }, value: "john@example.com" },
        { attributeKey: { key: "name" }, value: "John" },
      ],
    } as any);
    const csvData = [{ email: "john@example.com", name: "John" }];
    const result = await createContactsFromCSV(csvData, environmentId, "update", {
      email: "email",
      name: "name",
    });
    expect(result[0].id).toBe("c1");
  });

  test("overwrites contact with 'overwrite' action", async () => {
    vi.mocked(prisma.contact.findMany).mockResolvedValue([
      {
        id: "c1",
        attributes: [
          { attributeKey: { key: "email" }, value: "john@example.com" },
          { attributeKey: { key: "name" }, value: "Old" },
        ],
      },
    ]);
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
    vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([
      { key: "email", id: "id-email" },
      { key: "name", id: "id-name" },
    ]);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 2 });
    vi.mocked(prisma.contact.update).mockResolvedValue({
      id: "c1",
      environmentId,
      createdAt: new Date(),
      updatedAt: new Date(),
      attributes: [
        { attributeKey: { key: "email" }, value: "john@example.com" },
        { attributeKey: { key: "name" }, value: "John" },
      ],
    } as any);
    const csvData = [{ email: "john@example.com", name: "John" }];
    const result = await createContactsFromCSV(csvData, environmentId, "overwrite", {
      email: "email",
      name: "name",
    });
    expect(result[0].id).toBe("c1");
  });

  test("throws ValidationError if email is missing in CSV", async () => {
    const csvData = [{ name: "John" }];
    await expect(
      createContactsFromCSV(csvData as any, environmentId, "skip", { name: "name" })
    ).rejects.toThrow(ValidationError);
  });

  test("throws DatabaseError on Prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("DB error", {
      code: "P2002",
      clientVersion: "1.0.0",
    });
    vi.mocked(prisma.contact.findMany).mockRejectedValue(prismaError);
    const csvData = [{ email: "john@example.com", name: "John" }];
    await expect(
      createContactsFromCSV(csvData, environmentId, "skip", { email: "email", name: "name" })
    ).rejects.toThrow(DatabaseError);
  });

  test("throws original error on unknown error", async () => {
    const genericError = new Error("Unknown error");
    vi.mocked(prisma.contact.findMany).mockRejectedValue(genericError);
    const csvData = [{ email: "john@example.com", name: "John" }];
    await expect(
      createContactsFromCSV(csvData, environmentId, "skip", { email: "email", name: "name" })
    ).rejects.toThrow(genericError);
  });
});

describe("buildContactWhereClause", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns where clause for email", () => {
    const environmentId = "env-1";
    const search = "john";
    const result = buildContactWhereClause(environmentId, search);
    expect(result).toEqual({
      environmentId,
      OR: [
        {
          attributes: {
            some: {
              value: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          id: {
            contains: search,
            mode: "insensitive",
          },
        },
      ],
    });
  });

  test("returns where clause without search", () => {
    const environmentId = "env-1";
    const result = buildContactWhereClause(environmentId);
    expect(result).toEqual({ environmentId });
  });
});
