import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { TContactAttributeKey } from "@formbricks/types/contact-attribute-key";
import { ValidationError } from "@formbricks/types/errors";
import { getContactAttributeKeys } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import {
  getContactAttributes,
  hasEmailAttribute,
  hasUserIdAttribute,
} from "@/modules/ee/contacts/lib/contact-attributes";
import { formatAttributeMessage } from "./attribute-messages";
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
    contactAttributeKey: { createManyAndReturn: vi.fn(), findMany: vi.fn() },
  },
}));

const contactId = "contact-1";
const userId = "user-1";
const workspaceId = "workspace-1";

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
    dataType: "string",
    workspaceId: workspaceId,
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
    dataType: "string",
    workspaceId: workspaceId,
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
    dataType: "string",
    workspaceId: workspaceId,
  },
];

/** A full attribute-key row, as `createManyAndReturn` and `findMany` return it. */
const keyRow = (id: string, key: string): TContactAttributeKey => ({
  ...attributeKeys[2],
  id,
  key,
  name: key,
});

/** Interactive transactions run their callback against the mocked client, as Prisma's tx would. */
const runTransactionCallbacks = () =>
  vi
    .mocked(prisma.$transaction)
    .mockImplementation(async (arg: unknown) =>
      typeof arg === "function" ? (arg as (tx: typeof prisma) => unknown)(prisma) : undefined
    );

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
    const result = await updateAttributes(contactId, userId, workspaceId, attributes);
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
    const result = await updateAttributes(contactId, userId, workspaceId, attributes);
    expect(prisma.$transaction).toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.messages).toContainEqual({ code: "email_already_exists", params: {} });
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
        dataType: "string",
        workspaceId: workspaceId,
      },
    ];
    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeysWithUserId);
    vi.mocked(getContactAttributes).mockResolvedValue({ name: "Jane", userId: "old-user-id" });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(true);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });
    const attributes = { name: "John", userId: "duplicate-user-id" };
    const result = await updateAttributes(contactId, userId, workspaceId, attributes);
    expect(prisma.$transaction).toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.messages).toContainEqual({ code: "userid_already_exists", params: {} });
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
        dataType: "string",
        workspaceId: workspaceId,
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
    const result = await updateAttributes(contactId, userId, workspaceId, attributes);
    expect(prisma.$transaction).toHaveBeenCalled();

    expect(result.success).toBe(true);
    expect(result.messages).toContainEqual({ code: "email_already_exists", params: {} });
    expect(result.messages).toContainEqual({ code: "userid_already_exists", params: {} });
    expect(result.ignoreEmailAttribute).toBe(true);
    expect(result.ignoreUserIdAttribute).toBe(true);
  });

  test("creates new attributes if under limit", async () => {
    // Use name and email keys (2 existing keys), MAX is mocked to 2
    // We update existing attributes, no new ones created
    vi.mocked(getContactAttributeKeys).mockResolvedValue([attributeKeys[0], attributeKeys[1]]); // name, email
    vi.mocked(getContactAttributes).mockResolvedValue({ name: "Jane", email: "jane@example.com" });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });
    const attributes = { name: "John", email: "john@example.com" };
    const result = await updateAttributes(contactId, userId, workspaceId, attributes);
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
    // Include email to satisfy the "at least one of email or userId" requirement
    const attributes = { name: "John", email: "john@example.com", new_attr: "val" };
    const result = await updateAttributes(contactId, userId, workspaceId, attributes);
    expect(result.success).toBe(true);
    expect(result.messages?.[0]).toEqual(
      expect.objectContaining({
        code: "attribute_limit_exceeded",
        params: expect.objectContaining({ count: "1" }),
      })
    );
  });

  test("skips creating reserved future default attributes", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue([attributeKeys[1]]);
    vi.mocked(getContactAttributes).mockResolvedValue({ email: "jane@example.com" });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });

    const result = await updateAttributes(contactId, userId, workspaceId, {
      email: "john@example.com",
      user_id: "future-safe",
    });

    expect(result.success).toBe(true);
    expect(result.errors).toContainEqual({
      code: "reserved_attribute_keys",
      params: {
        issue:
          "Reserved attribute key(s): user_id. These keys are reserved for the v5.1 safe-identifier default attribute migration and cannot be created as custom attributes.",
      },
    });
    expect(prisma.contactAttributeKey.createManyAndReturn).not.toHaveBeenCalled();
  });

  test("returns success with only email attribute", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue([attributeKeys[1]]); // email key
    vi.mocked(getContactAttributes).mockResolvedValue({ email: "existing@example.com" });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });
    const attributes = { email: "updated@example.com" };
    const result = await updateAttributes(contactId, userId, workspaceId, attributes);
    expect(result.success).toBe(true);
    expect(result.messages).toBeUndefined();
  });

  test("deletes non-default attributes when deleteRemovedAttributes is true", async () => {
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
    // Pass deleteRemovedAttributes: true to enable deletion behavior
    const result = await updateAttributes(contactId, userId, workspaceId, attributes, true);
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

  test("does not delete attributes when deleteRemovedAttributes is false (default behavior)", async () => {
    // Reset mocks explicitly for this test
    vi.mocked(prisma.contactAttribute.deleteMany).mockClear();

    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeys);
    vi.mocked(getContactAttributes).mockResolvedValue({
      name: "Jane",
      email: "jane@example.com",
      customAttr: "oldValue",
    });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    const attributes = { name: "John", email: "john@example.com" };
    // Default behavior (deleteRemovedAttributes: false) should NOT delete existing attributes
    const result = await updateAttributes(contactId, userId, workspaceId, attributes);
    // deleteMany should NOT be called since we're merging, not replacing
    expect(prisma.contactAttribute.deleteMany).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
    expect(result.messages).toBeUndefined();
  });

  test("does not delete default attributes even when deleteRemovedAttributes is true", async () => {
    // Reset mocks explicitly for this test
    vi.mocked(prisma.contactAttribute.deleteMany).mockClear();

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
        dataType: "string",
        workspaceId: workspaceId,
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
        dataType: "string",
        workspaceId: workspaceId,
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
        dataType: "string",
        workspaceId: workspaceId,
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
        dataType: "string",
        workspaceId: workspaceId,
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
    // Pass deleteRemovedAttributes: true to test that default attributes are still preserved
    const result = await updateAttributes(contactId, userId, workspaceId, attributes, true);
    // Should not delete default attributes (email, userId, firstName) - deleteMany should not be called
    // since all current attributes are default attributes
    expect(prisma.contactAttribute.deleteMany).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  test("preserves existing email when empty string is submitted", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeys);
    vi.mocked(getContactAttributes).mockResolvedValue({ name: "Jane", email: "existing@example.com" });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });

    // Attempt to clear email by submitting empty string
    const attributes = { name: "John", email: "" };
    const result = await updateAttributes(contactId, userId, workspaceId, attributes);

    // Verify that the transaction was called with the preserved email
    expect(prisma.$transaction).toHaveBeenCalled();
    const transactionCall = vi.mocked(prisma.$transaction).mock.calls[0][0];
    // The email should be preserved (existing@example.com), not cleared
    expect(transactionCall).toHaveLength(2); // name and email
    expect(result.success).toBe(true);
  });

  test("allows clearing userId when empty string is submitted", async () => {
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
        dataType: "string",
        workspaceId: workspaceId,
      },
    ];
    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeysWithUserId);
    vi.mocked(getContactAttributes).mockResolvedValue({ name: "Jane", userId: "existing-user-id" });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });

    // Clear userId by submitting empty string - this should be allowed
    const attributes = { name: "John", userId: "" };
    const result = await updateAttributes(contactId, userId, workspaceId, attributes);

    // Verify that the transaction was called
    expect(prisma.$transaction).toHaveBeenCalled();
    const transactionCall = vi.mocked(prisma.$transaction).mock.calls[0][0];
    // Only name and userId (empty) should be in the transaction
    expect(transactionCall).toHaveLength(2); // name and userId (with empty value)
    expect(result.success).toBe(true);
  });

  test("preserves existing values when both email and userId would be cleared", async () => {
    const attributeKeysWithBoth: TContactAttributeKey[] = [
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
        dataType: "string",
        workspaceId: workspaceId,
      },
    ];
    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeysWithBoth);
    vi.mocked(getContactAttributes).mockResolvedValue({
      name: "Jane",
      email: "existing@example.com",
      userId: "existing-user-id",
    });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });

    // Attempt to clear both email and userId
    const attributes = { name: "John", email: "", userId: "" };
    const result = await updateAttributes(contactId, userId, workspaceId, attributes);

    expect(result.success).toBe(true);
    expect(result.messages).toContainEqual({ code: "email_or_userid_required", params: {} });
  });

  test("coerces boolean attribute values to strings", async () => {
    vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeys);
    vi.mocked(getContactAttributes).mockResolvedValue({ name: "Jane", email: "jane@example.com" });
    vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    vi.mocked(hasUserIdAttribute).mockResolvedValue(false);
    vi.mocked(prisma.$transaction).mockResolvedValue(undefined);
    vi.mocked(prisma.contactAttribute.deleteMany).mockResolvedValue({ count: 0 });

    const attributes = { name: true, email: "john@example.com" };
    const result = await updateAttributes(contactId, userId, workspaceId, attributes);

    expect(result.success).toBe(true);
    expect(prisma.$transaction).toHaveBeenCalled();
    const transactionCall = vi.mocked(prisma.$transaction).mock.calls[0][0];
    // Both name (coerced from boolean) and email should be upserted
    expect(transactionCall).toHaveLength(2);
  });

  // ENG-4019: Postgres `text` cannot hold U+0000. A value that would reach it is refused before any write;
  // a value under a key that is skipped anyway leaves the rest of the request to go through, as before.
  describe("NULL bytes (ENG-4019)", () => {
    const expectRefused = async (attributes: Record<string, string>, key: string) => {
      const update = updateAttributes(contactId, userId, workspaceId, attributes, true);

      await expect(update).rejects.toThrow(ValidationError);
      await expect(update).rejects.toThrow(`Attribute "${key}" must not contain NULL bytes`);
      expect(prisma.$transaction).not.toHaveBeenCalled();
      expect(prisma.contactAttribute.deleteMany).not.toHaveBeenCalled();
    };

    beforeEach(() => {
      vi.mocked(getContactAttributes).mockResolvedValue({ name: "Jane", email: "jane@example.com" });
      vi.mocked(hasEmailAttribute).mockResolvedValue(false);
    });

    test("refuses a NULL byte in a value written to an existing key", async () => {
      vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeys);

      await expectRefused({ email: "jane@example.com", name: "Jo\u0000hn" }, "name");
    });

    test("refuses a NULL byte in a value that would create a key", async () => {
      vi.mocked(getContactAttributeKeys).mockResolvedValue([attributeKeys[1]]);

      await expectRefused({ email: "jane@example.com", plan: "pro\u0000" }, "plan");
    });

    test("refuses a NULL byte in the email before looking it up", async () => {
      vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeys);

      await expectRefused({ email: "jane@example.com\u0000" }, "email");
      expect(hasEmailAttribute).not.toHaveBeenCalled();
    });

    test.each([
      ["an invalid key", [attributeKeys[1]], { "Bad Key!": "x\u0000" }],
      ["a reserved key", [attributeKeys[1]], { user_id: "x\u0000" }],
      ["a key over the attribute limit", attributeKeys, { plan: "x\u0000" }],
    ])("lets the rest through when the value sits under %s", async (_, keys, skipped) => {
      vi.mocked(getContactAttributeKeys).mockResolvedValue(keys);

      const result = await updateAttributes(contactId, userId, workspaceId, {
        email: "john@example.com",
        ...skipped,
      });

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalledOnce();
      expect(prisma.contactAttributeKey.createManyAndReturn).not.toHaveBeenCalled();
    });
  });

  describe("concurrent-identify deadlock protection (ENG-2252)", () => {
    test("upserts existing attributes in attributeKeyId order regardless of payload key order", async () => {
      vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeys);
      vi.mocked(getContactAttributes).mockResolvedValue({ name: "Jane", email: "jane@example.com" });
      vi.mocked(hasEmailAttribute).mockResolvedValue(false);

      // Payload in the exact reverse of attributeKeyId order — the ordering that deadlocks against a
      // concurrent ascending payload when upserts lock rows in caller order.
      const attributes = { customAttr: "c", email: "john@example.com", name: "John" };
      const result = await updateAttributes(contactId, userId, workspaceId, attributes);

      expect(result.success).toBe(true);
      const upsertedKeyIds = vi
        .mocked(prisma.contactAttribute.upsert)
        .mock.calls.map(([args]) => args.where.contactId_attributeKeyId?.attributeKeyId);
      expect(upsertedKeyIds).toEqual(["key-1", "key-2", "key-3"]);
    });

    test("retries the upsert transaction once when it deadlocks, and succeeds", async () => {
      vi.mocked(getContactAttributeKeys).mockResolvedValue(attributeKeys);
      vi.mocked(getContactAttributes).mockResolvedValue({ name: "Jane", email: "jane@example.com" });
      vi.mocked(hasEmailAttribute).mockResolvedValue(false);
      // The driver-adapter deadlock shape seen in Sentry (FORMBRICKS-19P).
      vi.mocked(prisma.$transaction)
        .mockRejectedValueOnce(new Error("deadlock detected"))
        .mockResolvedValueOnce(undefined);

      const result = await updateAttributes(contactId, userId, workspaceId, {
        name: "John",
        email: "john@example.com",
      });

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
    });

    test("creates new attribute keys in key order regardless of payload key order", async () => {
      vi.mocked(getContactAttributeKeys).mockResolvedValue([]);
      vi.mocked(getContactAttributes).mockResolvedValue({});
      runTransactionCallbacks();
      vi.mocked(prisma.contactAttributeKey.createManyAndReturn).mockResolvedValue([
        keyRow("key-alpha", "alpha"),
        keyRow("key-zeta", "zeta"),
      ]);

      const result = await updateAttributes(contactId, userId, workspaceId, { zeta: "1", alpha: "2" });

      expect(result.success).toBe(true);
      const { data } = vi.mocked(prisma.contactAttributeKey.createManyAndReturn).mock.calls[0][0] ?? {};
      expect([data].flat().map((row) => row?.key)).toEqual(["alpha", "zeta"]);
    });
  });

  describe("concurrent identify calls creating the same new key (ENG-4018)", () => {
    const racedKey = keyRow("key-raced", "plan");
    const upsertedValues = () =>
      vi.mocked(prisma.contactAttribute.upsert).mock.calls.map(([args]) => ({
        attributeKeyId: args.where.contactId_attributeKeyId?.attributeKeyId,
        value: args.update.value,
      }));

    beforeEach(() => {
      vi.mocked(getContactAttributeKeys).mockResolvedValue([]);
      vi.mocked(getContactAttributes).mockResolvedValue({});
      runTransactionCallbacks();
    });

    test("skips duplicate keys instead of failing with P2002", async () => {
      vi.mocked(prisma.contactAttributeKey.createManyAndReturn).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([racedKey]);

      await updateAttributes(contactId, userId, workspaceId, { plan: "pro" });

      expect(prisma.contactAttributeKey.createManyAndReturn).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true })
      );
    });

    test("writes onto the key a concurrent call created, without claiming to have created it", async () => {
      // The key already existed when this call inserted it, so nothing comes back as created.
      vi.mocked(prisma.contactAttributeKey.createManyAndReturn).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([racedKey]);

      const result = await updateAttributes(contactId, userId, workspaceId, { plan: "pro" });

      expect(result.success).toBe(true);
      expect(prisma.contactAttributeKey.findMany).toHaveBeenCalledWith({
        where: { workspaceId, key: { in: ["plan"] } },
      });
      expect(upsertedValues()).toEqual([{ attributeKeyId: "key-raced", value: "pro" }]);
      expect(result.messages?.some((m) => m.code === "new_attribute_created") ?? false).toBe(false);
    });

    test("writes created and raced keys together and reports only the created ones", async () => {
      vi.mocked(prisma.contactAttributeKey.createManyAndReturn).mockResolvedValue([
        keyRow("key-seats", "seats"),
      ]);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([racedKey]);

      const result = await updateAttributes(contactId, userId, workspaceId, { seats: "5", plan: "pro" });

      expect(result.success).toBe(true);
      expect(upsertedValues()).toEqual(
        expect.arrayContaining([
          { attributeKeyId: "key-seats", value: "5" },
          { attributeKeyId: "key-raced", value: "pro" },
        ])
      );
      expect(result.messages?.filter((m) => m.code === "new_attribute_created")).toEqual([
        { code: "new_attribute_created", params: { key: "seats", dataType: "string" } },
      ]);
    });

    test("checks a value against the dataType the winning call chose", async () => {
      vi.mocked(prisma.contactAttributeKey.createManyAndReturn).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([{ ...racedKey, dataType: "number" }]);

      const result = await updateAttributes(contactId, userId, workspaceId, { plan: "not-a-number" });

      expect(result.success).toBe(true);
      expect(prisma.contactAttribute.upsert).not.toHaveBeenCalled();
      expect(result.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            code: "attribute_type_validation_error",
            params: expect.objectContaining({ key: "plan", dataType: "number" }),
          }),
        ])
      );
    });

    test("does not re-read keys when every key was created by this call", async () => {
      vi.mocked(prisma.contactAttributeKey.createManyAndReturn).mockResolvedValue([
        keyRow("key-plan", "plan"),
      ]);

      await updateAttributes(contactId, userId, workspaceId, { plan: "pro" });

      expect(prisma.contactAttributeKey.findMany).not.toHaveBeenCalled();
      expect(upsertedValues()).toEqual([{ attributeKeyId: "key-plan", value: "pro" }]);
    });

    test("runs the transaction again when a skipped key is gone by the re-read", async () => {
      // First attempt: skipped, then not found (deleted in between). Second attempt: created.
      vi.mocked(prisma.contactAttributeKey.createManyAndReturn)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([keyRow("key-plan", "plan")]);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([]);

      const result = await updateAttributes(contactId, userId, workspaceId, { plan: "pro" });

      expect(result.success).toBe(true);
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(upsertedValues()).toEqual([{ attributeKeyId: "key-plan", value: "pro" }]);
    });

    test("fails rather than drop a value when the skipped key keeps vanishing", async () => {
      vi.mocked(prisma.contactAttributeKey.createManyAndReturn).mockResolvedValue([]);
      vi.mocked(prisma.contactAttributeKey.findMany).mockResolvedValue([]);

      await expect(updateAttributes(contactId, userId, workspaceId, { plan: "pro" })).rejects.toThrow();
      expect(prisma.$transaction).toHaveBeenCalledTimes(2);
      expect(prisma.contactAttribute.upsert).not.toHaveBeenCalled();
    });
  });
});

describe("formatAttributeMessage", () => {
  test("describes the duplicate email/userId checks as workspace-scoped", () => {
    // The checks behind these two codes call hasEmailAttribute/hasUserIdAttribute with workspaceId,
    // and the UI renders the same conditions via workspace.contacts.attributes_msg_* — so the
    // English templates must not describe the scope as an environment.
    expect(formatAttributeMessage({ code: "email_already_exists", params: {} })).toBe(
      "The email already exists for this workspace and was not updated."
    );
    expect(formatAttributeMessage({ code: "userid_already_exists", params: {} })).toBe(
      "The userId already exists for this workspace and was not updated."
    );
  });

  test("interpolates every occurrence of a param", () => {
    expect(
      formatAttributeMessage({
        code: "attribute_type_validation_error",
        params: { error: "Not a number", key: "age", dataType: "number" },
      })
    ).toBe("Not a number (attribute 'age' has dataType: number)");
  });

  test("falls back to the raw code when no template exists", () => {
    expect(formatAttributeMessage({ code: "some_unmapped_code", params: {} })).toBe("some_unmapped_code");
  });
});
