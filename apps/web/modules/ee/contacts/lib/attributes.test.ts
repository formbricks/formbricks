import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import {
  getContactAttributes,
  hasEmailAttribute,
  hasUserIdAttribute,
} from "@/modules/ee/contacts/lib/contact-attributes";
import { updateAttributes } from "./attributes";

vi.mock("@/lib/constants", () => ({
  MAX_ATTRIBUTE_CLASSES_PER_ENVIRONMENT: 2,
}));
vi.mock("@/lib/utils/validate", () => ({
  validateInputs: vi.fn(),
}));
vi.mock("@/modules/ee/contacts/lib/contact-attribute-keys", () => ({
  getContactAttributeKeys: vi.fn(),
}));
vi.mock("@/modules/ee/contacts/lib/contact-attributes", async () => {
  const actual = await vi.importActual("@/modules/ee/contacts/lib/contact-attributes");
  return {
    ...actual,
    getContactAttributes: vi.fn(),
    hasEmailAttribute: vi.fn(),
    hasUserIdAttribute: vi.fn(),
  };
});
vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    contactAttribute: { upsert: vi.fn(), findMany: vi.fn(), deleteMany: vi.fn() },
    contactAttributeKey: { create: vi.fn() },
  },
}));

const contactId = "contact-1";
const userId = "user-1";
const environmentId = "env-1";

const attributeKeys: TContactAttributeKey[] = [
  {
    id: "key-1",
    key: "name",
    createdAt: new Date(),
    updatedAt: new Date(),
    isUnique: false,
    name: "Name",
    description: null,
    type: "default",
    environmentId,
  },
  {
    id: "key-2",
    key: "email",
    createdAt: new Date(),
    updatedAt: new Date(),
    isUnique: false,
    name: "Email",
    description: null,
    type: "default",
    environmentId,
  },
  {
    id: "key-3",
    key: "customAttr",
    createdAt: new Date(),
    updatedAt: new Date(),
    isUnique: false,
    name: "Custom Attribute",
    description: null,
    type: "custom",
    environmentId,
  },
];

describe("updateAttributes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set default mock return values - these will be overridden in individual tests
    vi.mocked(getContactAttributes).mockResolvedValue({});
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
  });

  test("updates existing attributes", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeys);
    vi.mocked(getContactAttributes).mockResolvedValue({ name: "Jane", email: "jane@example.com" });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });
    const attributes = { name: "John", email: "john@example.com" };
    const result = await updateAttributes(contactId, userId, environmentId, attributes);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.messages).toBeUndefined();
  });

  test("skips updating email if it already exists", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeys);
    vi.mocked(getContactAttributes).mockResolvedValue({ name: "Jane", email: "jane@example.com" });
    vi.mocked(hasEmailAttribute).mockResolvedValue(true);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });
    const attributes = { name: "John", email: "john@example.com" };
    const result = await updateAttributes(contactId, userId, environmentId, attributes);
    expect(prisma.$transaction).toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.messages).toContain("The email already exists for this environment and was not updated.");
  });

  test("skips updating userId if it already exists", async () => {
    const attributeKeysWithUserId: TContactAttributeKey[] = [
      ...attributeKeys,
      {
        id: "key-4",
        key: "userId",
        createdAt: new Date(),
        updatedAt: new Date(),
        isUnique: true,
        name: "User ID",
        description: null,
        type: "default",
        environmentId,
      },
    ];
    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeysWithUserId);
    vi.mocked(getContactAttributes).mockResolvedValue({ name: "Jane", userId: "old-user-id" });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(true);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });
    const attributes = { name: "John", userId: "duplicate-user-id" };
    const result = await updateAttributes(contactId, userId, environmentId, attributes);
    expect(prisma.$transaction).toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.messages).toContain("The userId already exists for this environment and was not updated.");
    expect(result.ignoreUserIdAttribute).toBe(true);
  });

  test("skips updating both email and userId if both already exist", async () => {
    const attributeKeysWithUserId: TContactAttributeKey[] = [
      ...attributeKeys,
      {
        id: "key-4",
        key: "userId",
        createdAt: new Date(),
        updatedAt: new Date(),
        isUnique: true,
        name: "User ID",
        description: null,
        type: "default",
        environmentId,
      },
    ];
    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeysWithUserId);
    vi.mocked(getContactAttributes).mockResolvedValue({
      name: "Jane",
      email: "old@example.com",
      userId: "old-user-id",
    });
    vi.mocked(hasEmailAttribute).mockResolvedValue(true);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(true);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });
    const attributes = { name: "John", email: "duplicate@example.com", userId: "duplicate-user-id" };
    const result = await updateAttributes(contactId, userId, environmentId, attributes);
    expect(prisma.$transaction).toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.messages).toContain("The email already exists for this environment and was not updated.");
    expect(result.messages).toContain("The userId already exists for this environment and was not updated.");
    expect(result.ignoreEmailAttribute).toBe(true);
    expect(result.ignoreUserIdAttribute).toBe(true);
  });

  test("creates new attributes if under limit", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue([attributeKeys[0]]);
    vi.mocked(getContactAttributes).mockResolvedValue({ name: "Jane" });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });
    const attributes = { name: "John", newAttr: "val" };
    const result = await updateAttributes(contactId, userId, environmentId, attributes);
    expect(prisma.$transaction).toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.messages).toBeUndefined();
  });

  test("does not create new attributes if over the limit", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeys);
    vi.mocked(getContactAttributes).mockResolvedValue({ name: "Jane", email: "jane@example.com" });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });
    const attributes = { name: "John", newAttr: "val" };
    const result = await updateAttributes(contactId, userId, environmentId, attributes);
    expect(result.success).toBe(true);
    expect(result.messages?.[0]).toMatch(/Could not create 1 new attribute/);
  });

  test("returns success with no attributes to update or create", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue([]);
    vi.mocked(getContactAttributes).mockResolvedValue({});
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });
    const attributes = {};
    const result = await updateAttributes(contactId, userId, environmentId, attributes);
    expect(result.success).toBe(true);
    expect(result.messages).toBeUndefined();
  });

  test("deletes non-default attributes that are removed from payload", async () => {
    // Reset mocks explicitly for this test
    vi.mocked(prisma.contactAttribute.deleteMany).mockClear();

    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeys);
    vi.mocked(getContactAttributes).mockResolvedValue({
      name: "Jane",
      email: "jane@example.com",
      customAttr: "oldValue",
    });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 1 });
    const attributes = { name: "John", email: "john@example.com" };
    const result = await updateAttributes(contactId, userId, environmentId, attributes);
    // Only customAttr (key-3) should be deleted, not name (key-1) or email (key-2)
    expect(prisma.contactAttribute.deleteMany).toHaveBeenCalledWith({
      where: {
        contactId,
        attributeKeyId: {
          in: ["key-3"],
        },
      },
    });
    expect(result.success).toBe(true);
    expect(result.messages).toBeUndefined();
  });

  test("does not delete default attributes even if removed from payload", async () => {
    // Reset mocks explicitly for this test
    vi.mocked(prisma.contactAttribute.deleteMany).mockClear();

    // Need to include userId and firstName in attributeKeys for this test
    // Note: DEFAULT_ATTRIBUTES includes: email, userId, firstName, lastName (not "name")
    const attributeKeysWithDefaults: TContactAttributeKey[] = [
      {
        id: "key-2",
        key: "email",
        createdAt: new Date(),
        updatedAt: new Date(),
        isUnique: false,
        name: "Email",
        description: null,
        type: "default",
        environmentId,
      },
      {
        id: "key-4",
        key: "userId",
        createdAt: new Date(),
        updatedAt: new Date(),
        isUnique: false,
        name: "User ID",
        description: null,
        type: "default",
        environmentId,
      },
      {
        id: "key-5",
        key: "firstName",
        createdAt: new Date(),
        updatedAt: new Date(),
        isUnique: false,
        name: "First Name",
        description: null,
        type: "default",
        environmentId,
      },
      {
        id: "key-3",
        key: "customAttr",
        createdAt: new Date(),
        updatedAt: new Date(),
        isUnique: false,
        name: "Custom Attribute",
        description: null,
        type: "custom",
        environmentId,
      },
    ];
    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeysWithDefaults);
    vi.mocked(getContactAttributes).mockResolvedValue({
      email: "test@example.com",
      userId: "user-123",
      firstName: "John",
    });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });
    const attributes = { customAttr: "value" };
    const result = await updateAttributes(contactId, userId, environmentId, attributes);
    // Should not delete default attributes (email, userId, firstName) - deleteMany should not be called
    // since all current attributes are default attributes
    expect(prisma.contactAttribute.deleteMany).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });
});
