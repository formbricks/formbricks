import { Prisma } from "@prisma/client";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TContactAttribute } from "@formbricks/types/contact-attribute";
import { DatabaseError } from "@formbricks/types/errors";
import {
  getContactAttributes,
  getContactAttributesWithMetadata,
  hasEmailAttribute,
  hasUserIdAttribute,
} from "./contact-attributes";

vi.mock("@formbricks/database", () => ({
  prisma: {
    contactAttribute: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));
vi.mock("@/lib/utils/validate", () => ({ validateInputs: vi.fn() }));

const contactId = "contact-1";
const environmentId = "env-1";
const email = "john@example.com";
const userId = "user-123";

const mockAttributes = [
  { value: "john@example.com", attributeKey: { key: "email", name: "Email" } },
  { value: "John", attributeKey: { key: "name", name: "Name" } },
] as unknown as TContactAttribute[];

const mockAttributesWithMetadata = [
  {
    value: "john@example.com",
    valueNumber: null,
    valueDate: null,
    attributeKey: { key: "email", name: "Email", dataType: "string" },
  },
  {
    value: "John Doe",
    valueNumber: null,
    valueDate: null,
    attributeKey: { key: "name", name: "Name", dataType: "string" },
  },
  {
    value: "42",
    valueNumber: 42,
    valueDate: null,
    attributeKey: { key: "age", name: "Age", dataType: "number" },
  },
  {
    value: "2024-06-15T00:00:00.000Z",
    valueNumber: null,
    valueDate: new Date("2024-06-15T00:00:00.000Z"),
    attributeKey: { key: "signupDate", name: "Signup Date", dataType: "date" },
  },
];

describe("getContactAttributes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns attributes as object", async () => {
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue(mockAttributes);
    const result = await getContactAttributes(contactId);
    expect(prisma.contactAttribute.findMany).toHaveBeenCalledWith({
      where: { contactId },
      select: {
        value: true,
        valueNumber: true,
        valueDate: true,
        attributeKey: { select: { key: true, name: true, dataType: true } },
      },
    });
    expect(result).toEqual({ email: "john@example.com", name: "John" });
  });

  test("returns empty object if no attributes", async () => {
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);
    const result = await getContactAttributes(contactId);
    expect(result).toEqual({});
  });

  test("throws DatabaseError on Prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.contactAttribute.findMany).mockRejectedValue(prismaError);

    await expect(getContactAttributes(contactId)).rejects.toThrow(DatabaseError);
  });

  test("rethrows non-Prisma errors", async () => {
    const genericError = new Error("Generic error");
    vi.mocked(prisma.contactAttribute.findMany).mockRejectedValue(genericError);

    await expect(getContactAttributes(contactId)).rejects.toThrow("Generic error");
  });
});

describe("getContactAttributesWithMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns attributes with full metadata", async () => {
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue(
      mockAttributesWithMetadata as unknown as Prisma.Result<
        typeof prisma.contactAttribute,
        unknown,
        "findMany"
      >
    );

    const result = await getContactAttributesWithMetadata(contactId);

    expect(prisma.contactAttribute.findMany).toHaveBeenCalledWith({
      where: { contactId },
      select: {
        value: true,
        valueNumber: true,
        valueDate: true,
        attributeKey: { select: { key: true, name: true, dataType: true } },
      },
    });

    expect(result).toHaveLength(4);
    expect(result[0]).toEqual({
      key: "email",
      name: "Email",
      value: "john@example.com",
      valueNumber: null,
      valueDate: null,
      dataType: "string",
    });
    expect(result[1]).toEqual({
      key: "name",
      name: "Name",
      value: "John Doe",
      valueNumber: null,
      valueDate: null,
      dataType: "string",
    });
    expect(result[2]).toEqual({
      key: "age",
      name: "Age",
      value: "42",
      valueNumber: 42,
      valueDate: null,
      dataType: "number",
    });
    expect(result[3]).toEqual({
      key: "signupDate",
      name: "Signup Date",
      value: "2024-06-15T00:00:00.000Z",
      valueNumber: null,
      valueDate: new Date("2024-06-15T00:00:00.000Z"),
      dataType: "date",
    });
  });

  test("returns empty array if no attributes", async () => {
    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue([]);

    const result = await getContactAttributesWithMetadata(contactId);

    expect(result).toEqual([]);
  });

  test("correctly maps all data types", async () => {
    const mixedTypeAttributes = [
      {
        value: "text value",
        valueNumber: null,
        valueDate: null,
        attributeKey: { key: "stringAttr", name: "String Attr", dataType: "string" },
      },
      {
        value: "100",
        valueNumber: 100,
        valueDate: null,
        attributeKey: { key: "numberAttr", name: "Number Attr", dataType: "number" },
      },
      {
        value: "2024-01-01T00:00:00.000Z",
        valueNumber: null,
        valueDate: new Date("2024-01-01T00:00:00.000Z"),
        attributeKey: { key: "dateAttr", name: "Date Attr", dataType: "date" },
      },
    ];

    vi.mocked(prisma.contactAttribute.findMany).mockResolvedValue(
      mixedTypeAttributes as unknown as Prisma.Result<typeof prisma.contactAttribute, unknown, "findMany">
    );

    const result = await getContactAttributesWithMetadata(contactId);

    expect(result).toHaveLength(3);
    expect(result[0].dataType).toBe("string");
    expect(result[0].valueNumber).toBeNull();
    expect(result[0].valueDate).toBeNull();

    expect(result[1].dataType).toBe("number");
    expect(result[1].valueNumber).toBe(100);
    expect(result[1].valueDate).toBeNull();

    expect(result[2].dataType).toBe("date");
    expect(result[2].valueNumber).toBeNull();
    expect(result[2].valueDate).toBeInstanceOf(Date);
  });

  test("throws DatabaseError on Prisma error", async () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError("Test error", {
      code: "P2002",
      clientVersion: "5.0.0",
    });
    vi.mocked(prisma.contactAttribute.findMany).mockRejectedValue(prismaError);

    await expect(getContactAttributesWithMetadata(contactId)).rejects.toThrow(DatabaseError);
  });

  test("rethrows non-Prisma errors", async () => {
    const genericError = new Error("Generic error");
    vi.mocked(prisma.contactAttribute.findMany).mockRejectedValue(genericError);

    await expect(getContactAttributesWithMetadata(contactId)).rejects.toThrow("Generic error");
  });
});

describe("hasEmailAttribute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns true if email attribute exists", async () => {
    vi.mocked(prisma.contactAttribute.findFirst).mockResolvedValue({
      id: "attr-1",
    } as unknown as TContactAttribute);
    const result = await hasEmailAttribute(email, environmentId, contactId);
    expect(prisma.contactAttribute.findFirst).toHaveBeenCalledWith({
      where: {
        AND: [{ attributeKey: { key: "email", environmentId }, value: email }, { NOT: { contactId } }],
      },
      select: { id: true },
    });
    expect(result).toBe(true);
  });

  test("returns false if email attribute does not exist", async () => {
    vi.mocked(prisma.contactAttribute.findFirst).mockResolvedValue(null);
    const result = await hasEmailAttribute(email, environmentId, contactId);
    expect(result).toBe(false);
  });
});

describe("hasUserIdAttribute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns true if userId attribute exists on another contact", async () => {
    vi.mocked(prisma.contactAttribute.findFirst).mockResolvedValue({
      id: "attr-1",
    } as unknown as TContactAttribute);
    const result = await hasUserIdAttribute(userId, environmentId, contactId);
    expect(prisma.contactAttribute.findFirst).toHaveBeenCalledWith({
      where: {
        AND: [{ attributeKey: { key: "userId", environmentId }, value: userId }, { NOT: { contactId } }],
      },
      select: { id: true },
    });
    expect(result).toBe(true);
  });

  test("returns false if userId attribute does not exist on another contact", async () => {
    vi.mocked(prisma.contactAttribute.findFirst).mockResolvedValue(null);
    const result = await hasUserIdAttribute(userId, environmentId, contactId);
    expect(result).toBe(false);
  });
});

describe("error handling edge cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("hasEmailAttribute handles different email formats", async () => {
    vi.mocked(prisma.contactAttribute.findFirst).mockResolvedValue(null);

    // Test with various email formats
    await hasEmailAttribute("user+tag@example.com", environmentId, contactId);
    expect(prisma.contactAttribute.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([expect.objectContaining({ value: "user+tag@example.com" })]),
        }),
      })
    );
  });

  test("hasUserIdAttribute handles special characters in userId", async () => {
    vi.mocked(prisma.contactAttribute.findFirst).mockResolvedValue(null);

    await hasUserIdAttribute("user-123_abc", environmentId, contactId);
    expect(prisma.contactAttribute.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          AND: expect.arrayContaining([expect.objectContaining({ value: "user-123_abc" })]),
        }),
      })
    );
  });
});
