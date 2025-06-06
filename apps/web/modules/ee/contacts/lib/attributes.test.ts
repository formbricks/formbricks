import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { hasEmailAttribute } from "@/modules/ee/contacts/lib/contact-attributes";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
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
vi.mock("@/modules/ee/contacts/lib/contact-attributes", () => ({
  hasEmailAttribute: vi.fn(),
}));
vi.mock("@formbricks/database", () => ({
  prisma: {
    $transaction: vi.fn(),
    contactAttribute: { upsert: vi.fn() },
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
];

describe("updateAttributes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("updates existing attributes", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeys);
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    const attributes = { name: "John", email: "john@example.com" };
    const result = await updateAttributes(contactId, userId, environmentId, attributes);
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.messages).toEqual([]);
  });

  test("skips updating email if it already exists", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeys);
    vi.mocked(hasEmailAttribute).mockResolvedValue(true);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    const attributes = { name: "John", email: "john@example.com" };
    const result = await updateAttributes(contactId, userId, environmentId, attributes);
    expect(prisma.$transaction).toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.messages).toContain("The email already exists for this environment and was not updated.");
  });

  test("creates new attributes if under limit", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue([attributeKeys[0]]);
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    const attributes = { name: "John", newAttr: "val" };
    const result = await updateAttributes(contactId, userId, environmentId, attributes);
    expect(prisma.$transaction).toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.messages).toEqual([]);
  });

  test("does not create new attributes if over the limit", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeys);
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    const attributes = { name: "John", newAttr: "val" };
    const result = await updateAttributes(contactId, userId, environmentId, attributes);
    expect(result.success).toBe(true);
    expect(result.messages?.[0]).toMatch(/Could not create 1 new attribute/);
  });

  test("returns success with no attributes to update or create", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue([]);
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    const attributes = {};
    const result = await updateAttributes(contactId, userId, environmentId, attributes);
    expect(result.success).toBe(true);
    expect(result.messages).toEqual([]);
  });
});
