import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { createWorkspaceWithContactDirectory } from "@/integration/contact-directory-fixture";
import { resetDb } from "@/integration/reset-db";
import type { TWorkspaceContactDirectory } from "@/modules/ee/contacts/lib/contact-directory";
import { createContactsFromCSV } from "@/modules/ee/contacts/lib/contacts-csv-upload";

/**
 * A CSV import against real Postgres: an email or userId belongs to one contact of a directory, as identify
 * keeps them. The database doesn't enforce it (no unique index on attribute values), so the import does:
 * a row naming a value another contact holds is imported without it. The unit suites mock Prisma, so only
 * a real database shows which contacts actually end up with which values.
 */

let workspaceId: string;
let directory: TWorkspaceContactDirectory;
let keyIds: Record<string, string>;

const setUp = async (matchingKey: "email" | "externalId") => {
  const organization = await prisma.organization.create({ data: { name: "CSV unique values Org" } });
  const created = await createWorkspaceWithContactDirectory(organization.id, "CSV");
  workspaceId = created.workspaceId;
  await prisma.contactDirectory.update({ where: { id: created.directoryId }, data: { matchingKey } });
  directory = { id: created.directoryId, matchingKey };
  const keys = ["userId", "email", "externalId"];
  await prisma.contactAttributeKey.createMany({
    data: keys.map((key) => ({
      key,
      name: key,
      type: "default" as const,
      isUnique: key !== "externalId",
      workspaceId,
      directoryId: directory.id,
    })),
  });
  const rows = await prisma.contactAttributeKey.findMany({ where: { directoryId: directory.id } });
  keyIds = Object.fromEntries(rows.map((row) => [row.key, row.id]));
};

const seedContact = async (attributes: Record<string, string>) =>
  (
    await prisma.contact.create({
      data: {
        workspaceId,
        directoryId: directory.id,
        attributes: {
          create: Object.entries(attributes).map(([key, value]) => ({ attributeKeyId: keyIds[key], value })),
        },
      },
      select: { id: true },
    })
  ).id;

/** Every contact of the directory holding `value` under `key`. */
const holdersOf = async (key: string, value: string) =>
  (
    await prisma.contactAttribute.findMany({
      where: { attributeKeyId: keyIds[key], value },
      select: { contactId: true },
    })
  ).map(({ contactId }) => contactId);

const valueOf = async (contactId: string, key: string) =>
  (await prisma.contactAttribute.findFirst({ where: { contactId, attributeKeyId: keyIds[key] } }))?.value;

const importRows = (rows: Record<string, string>[], action: "skip" | "update" | "overwrite" = "update") =>
  createContactsFromCSV(rows, workspaceId, directory, action, {});

beforeEach(async () => {
  await resetDb();
});

describe("an external ID directory", () => {
  beforeEach(async () => {
    await setUp("externalId");
  });

  test("a new row keeps its externalId but not an email or userId another contact holds", async () => {
    const ann = await seedContact({ externalId: "CRM-1", email: "ann@example.com", userId: "ann" });

    const result = await importRows([{ externalId: "CRM-2", email: "ann@example.com", userId: "ann" }]);

    expect(result).toMatchObject({ leftOutCounts: { email: 1, userId: 1 } });
    expect(await holdersOf("email", "ann@example.com")).toEqual([ann]);
    expect(await holdersOf("userId", "ann")).toEqual([ann]);
    const [created] = await holdersOf("externalId", "CRM-2");
    expect(created).toBeDefined();
    expect(await valueOf(created, "email")).toBeUndefined();
  });

  test("an updated contact keeps its own email when the row names another contact's", async () => {
    const ann = await seedContact({ externalId: "CRM-1", email: "ann@example.com" });
    const bob = await seedContact({ externalId: "CRM-2", email: "bob@example.com" });

    for (const action of ["update", "overwrite"] as const) {
      const result = await importRows([{ externalId: "CRM-2", email: "ann@example.com" }], action);
      expect(result).toMatchObject({ leftOutCounts: { email: 1, userId: 0 } });
      expect(await holdersOf("email", "ann@example.com")).toEqual([ann]);
      expect(await valueOf(bob, "email")).toBe("bob@example.com");
    }
  });

  test("a row may restate its own contact's email", async () => {
    const ann = await seedContact({ externalId: "CRM-1", email: "ann@example.com" });

    const result = await importRows([{ externalId: "CRM-1", email: "ann@example.com" }]);

    expect(result).toMatchObject({ leftOutCounts: { email: 0, userId: 0 } });
    expect(await holdersOf("email", "ann@example.com")).toEqual([ann]);
  });

  test("two rows sharing an email are refused before anything is written", async () => {
    await expect(
      importRows([
        { externalId: "CRM-1", email: "shared@example.com" },
        { externalId: "CRM-2", email: "shared@example.com" },
      ])
    ).rejects.toThrow("Duplicate emails found in the records");
    expect(await prisma.contact.count({ where: { directoryId: directory.id } })).toBe(0);
  });
});

describe("an email directory", () => {
  beforeEach(async () => {
    await setUp("email");
  });

  // The email picks the contact here, so it never clashes; a userId still belongs to one contact.
  test("a new contact doesn't take another contact's userId", async () => {
    const ann = await seedContact({ email: "ann@example.com", userId: "ann" });

    const result = await importRows([{ email: "new@example.com", userId: "ann" }]);

    expect(result).toMatchObject({ leftOutCounts: { email: 0, userId: 1 } });
    expect(await holdersOf("userId", "ann")).toEqual([ann]);
    expect(await holdersOf("email", "new@example.com")).toHaveLength(1);
  });
});
