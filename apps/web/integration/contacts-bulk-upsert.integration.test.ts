import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import {
  createWorkspaceOnContactDirectory,
  createWorkspaceWithContactDirectory,
} from "@/integration/contact-directory-fixture";
import { resetDb } from "@/integration/reset-db";
import { upsertBulkContacts } from "@/modules/ee/contacts/api/v2/management/contacts/bulk/lib/contact";
import type { TContactBulkUploadContact } from "@/modules/ee/contacts/types/contact";

/**
 * Bulk contact upload against real Postgres (ENG-3549, ENG-7494).
 *
 * The attribute-key upsert is raw SQL that `unnest`s one array per column and conflicts on the
 * directory's `(directoryId, key)` unique index. How a JS array is bound there depends on the driver
 * adapter, and the unit suite mocks `$queryRaw`, so only a real client can show that keys are stored as
 * themselves and upserted inside the directory.
 */

const contact = (attributes: Record<string, string>): TContactBulkUploadContact => ({
  attributes: Object.entries(attributes).map(([key, value]) => ({ attributeKey: { key, name: key }, value })),
});

const seedWorkspace = async (name: string, matchingKey: "email" | "userId" = "email") => {
  const organization = await prisma.organization.create({ data: { name: `${name} Org` } });
  const { workspaceId, directoryId } = await createWorkspaceWithContactDirectory(
    organization.id,
    `${name} Workspace`
  );
  await prisma.contactDirectory.update({ where: { id: directoryId }, data: { matchingKey } });
  await prisma.contactAttributeKey.createMany({
    data: [
      { key: "email", name: "Email", workspaceId, directoryId, isUnique: true, type: "default" },
      { key: "userId", name: "User Id", workspaceId, directoryId, isUnique: true, type: "default" },
      { key: "plan", name: "Plan", workspaceId, directoryId },
    ],
  });
  return { organizationId: organization.id, workspaceId, directory: { id: directoryId, matchingKey } };
};

/** A contact of the directory with these attributes, created at `createdAt`. */
const seedContact = async (
  directoryId: string,
  workspaceId: string,
  attributes: Record<string, string>,
  createdAt: Date
) => {
  const keys = await prisma.contactAttributeKey.findMany({
    where: { directoryId, key: { in: Object.keys(attributes) } },
    select: { id: true, key: true },
  });
  return prisma.contact.create({
    data: {
      directoryId,
      workspaceId,
      createdAt,
      attributes: {
        create: Object.entries(attributes).map(([key, value]) => ({
          value,
          attributeKeyId: keys.find((k) => k.key === key)!.id,
        })),
      },
    },
    select: { id: true },
  });
};

const attributeValue = async (contactId: string, key: string) =>
  (
    await prisma.contactAttribute.findFirst({
      where: { contactId, attributeKey: { key } },
      select: { value: true },
    })
  )?.value;

beforeEach(async () => {
  await resetDb();
});

describe("upsertBulkContacts (real Postgres)", () => {
  test("creates a new attribute key and renames an existing one, scoped to the directory", async () => {
    const { workspaceId, directory } = await seedWorkspace("Upload");
    const other = await seedWorkspace("Other");

    const result = await upsertBulkContacts(
      [
        {
          attributes: [
            { attributeKey: { key: "email", name: "Email" }, value: "ada@example.com" },
            { attributeKey: { key: "plan", name: "Subscription Plan" }, value: "gold" },
            { attributeKey: { key: "seats", name: "Seats" }, value: "42" },
          ],
        },
        {
          attributes: [
            { attributeKey: { key: "email", name: "Email" }, value: "grace@example.com" },
            { attributeKey: { key: "plan", name: "Subscription Plan" }, value: "silver" },
            { attributeKey: { key: "seats", name: "Seats" }, value: "7" },
          ],
        },
      ],
      workspaceId,
      directory
    );

    expect(result.ok).toBe(true);

    const keys = await prisma.contactAttributeKey.findMany({
      where: { directoryId: directory.id, key: { in: ["plan", "seats"] } },
      select: { key: true, name: true, dataType: true, workspaceId: true },
      orderBy: { key: "asc" },
    });
    expect(keys).toEqual([
      { key: "plan", name: "Subscription Plan", dataType: "string", workspaceId },
      { key: "seats", name: "Seats", dataType: "number", workspaceId },
    ]);

    const contacts = await prisma.contact.findMany({
      where: { directoryId: directory.id },
      select: { workspaceId: true },
    });
    expect(contacts).toEqual([{ workspaceId }, { workspaceId }]);

    const attributes = await prisma.contactAttribute.findMany({
      where: { contact: { directoryId: directory.id }, attributeKey: { key: { in: ["plan", "seats"] } } },
      select: { value: true, valueNumber: true, attributeKey: { select: { key: true } } },
    });
    const stored = attributes
      .map((a) => `${a.attributeKey.key}=${a.value}${a.valueNumber === null ? "" : `#${a.valueNumber}`}`)
      .sort();
    expect(stored).toEqual(["plan=gold", "plan=silver", "seats=42#42", "seats=7#7"]);

    // The rename and the new key stay inside the uploading workspace's directory.
    const otherKeys = await prisma.contactAttributeKey.findMany({
      where: { directoryId: other.directory.id, key: { in: ["plan", "seats"] } },
      select: { key: true, name: true },
    });
    expect(otherKeys).toEqual([{ key: "plan", name: "Plan" }]);
  });

  test("in a shared directory, keys and contacts made from one workspace are reused from another", async () => {
    const first = await seedWorkspace("Shared");
    const secondWorkspaceId = await createWorkspaceOnContactDirectory(
      first.organizationId,
      first.directory.id
    );
    // A key the first workspace created after the directory was shared.
    await prisma.contactAttributeKey.create({
      data: { key: "tier", name: "Tier", workspaceId: first.workspaceId, directoryId: first.directory.id },
    });
    const existing = await seedContact(
      first.directory.id,
      first.workspaceId,
      { email: "ada@example.com" },
      new Date("2024-01-01")
    );

    const result = await upsertBulkContacts(
      [
        {
          attributes: [
            { attributeKey: { key: "email", name: "Email" }, value: "ada@example.com" },
            { attributeKey: { key: "tier", name: "Customer Tier" }, value: "gold" },
          ],
        },
      ],
      secondWorkspaceId,
      first.directory
    );

    expect(result.ok).toBe(true);
    expect(await prisma.contact.count({ where: { directoryId: first.directory.id } })).toBe(1);
    expect(await attributeValue(existing.id, "tier")).toBe("gold");

    // Renamed in place: one key, still recording the workspace that created it.
    const tierKeys = await prisma.contactAttributeKey.findMany({
      where: { directoryId: first.directory.id, key: "tier" },
      select: { name: true, workspaceId: true },
    });
    expect(tierKeys).toEqual([{ name: "Customer Tier", workspaceId: first.workspaceId }]);
  });

  test("a contact matching several existing ones updates the one with its userId, otherwise the oldest", async () => {
    const { workspaceId, directory } = await seedWorkspace("Duplicates");
    const oldest = await seedContact(
      directory.id,
      workspaceId,
      { email: "dup@example.com", userId: "u-old" },
      new Date("2024-01-01")
    );
    const sameUser = await seedContact(
      directory.id,
      workspaceId,
      { email: "dup@example.com", userId: "u-1" },
      new Date("2024-02-01")
    );
    const oldestOther = await seedContact(
      directory.id,
      workspaceId,
      { email: "other@example.com" },
      new Date("2024-01-01")
    );
    const newerOther = await seedContact(
      directory.id,
      workspaceId,
      { email: "other@example.com" },
      new Date("2024-03-01")
    );

    const result = await upsertBulkContacts(
      [
        contact({ email: "dup@example.com", userId: "u-1", plan: "pro" }),
        contact({ email: "other@example.com", plan: "free" }),
      ],
      workspaceId,
      directory
    );

    expect(result).toEqual({ ok: true, data: { contactIdxWithConflictingUserIds: [] } });
    expect(await attributeValue(sameUser.id, "plan")).toBe("pro");
    expect(await attributeValue(oldest.id, "plan")).toBeUndefined();
    expect(await attributeValue(oldestOther.id, "plan")).toBe("free");
    expect(await attributeValue(newerOther.id, "plan")).toBeUndefined();
    expect(await prisma.contact.count({ where: { directoryId: directory.id } })).toBe(4);
  });

  test("a userId directory matches and creates contacts by userId", async () => {
    const { workspaceId, directory } = await seedWorkspace("UserId", "userId");
    const existing = await seedContact(
      directory.id,
      workspaceId,
      { userId: "user-1", email: "shared@example.com" },
      new Date("2024-01-01")
    );

    const result = await upsertBulkContacts(
      [contact({ userId: "user-1", plan: "pro" }), contact({ userId: "user-2", email: "new@example.com" })],
      workspaceId,
      directory
    );

    expect(result).toEqual({ ok: true, data: { contactIdxWithConflictingUserIds: [] } });
    expect(await attributeValue(existing.id, "plan")).toBe("pro");
    expect(await prisma.contact.count({ where: { directoryId: directory.id } })).toBe(2);
  });

  test("a userId directory skips a contact taking an email another contact holds", async () => {
    const { workspaceId, directory } = await seedWorkspace("UserIdEmail", "userId");
    const holder = await seedContact(
      directory.id,
      workspaceId,
      { userId: "user-1", email: "shared@example.com" },
      new Date("2024-01-01")
    );
    const other = await seedContact(
      directory.id,
      workspaceId,
      { userId: "user-2", email: "other@example.com" },
      new Date("2024-01-01")
    );

    const result = await upsertBulkContacts(
      [
        // A new contact and an update, each taking the holder's email.
        contact({ userId: "user-3", email: "shared@example.com" }),
        contact({ userId: "user-2", email: "shared@example.com", plan: "pro" }),
        // The holder resending its own email is no conflict.
        contact({ userId: "user-1", email: "shared@example.com", plan: "free" }),
      ],
      workspaceId,
      directory
    );

    expect(result).toEqual({ ok: true, data: { contactIdxWithConflictingUserIds: [0, 1] } });
    expect(await prisma.contact.count({ where: { directoryId: directory.id } })).toBe(2);
    expect(await attributeValue(other.id, "email")).toBe("other@example.com");
    expect(await attributeValue(other.id, "plan")).toBeUndefined();
    expect(await attributeValue(holder.id, "plan")).toBe("free");
  });
});
