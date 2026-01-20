import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TContactAttribute } from "@formbricks/types/contact-attribute";
import { getContactAttributes, hasEmailAttribute, hasUserIdAttribute } from "./contact-attributes";

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
