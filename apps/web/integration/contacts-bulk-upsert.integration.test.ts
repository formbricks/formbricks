import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { upsertBulkContacts } from "@/modules/ee/contacts/api/v2/management/contacts/bulk/lib/contact";

/**
 * Bulk contact upload against real Postgres (ENG-3549).
 *
 * The attribute-key upsert is raw SQL that `unnest`s one array per column. How a JS array is bound
 * there depends on the driver adapter, and the unit suite mocks `$queryRaw`, so only a real client can
 * show that a new key and a renamed key are stored as themselves rather than as one `{"a","b"}` string.
 */

const seedWorkspace = async (name: string) => {
  const organization = await prisma.organization.create({ data: { name: `${name} Org` } });
  const workspace = await prisma.workspace.create({
    data: { name: `${name} Workspace`, organizationId: organization.id },
  });
  await prisma.contactAttributeKey.createMany({
    data: [
      { key: "email", name: "Email", workspaceId: workspace.id, isUnique: true, type: "default" },
      { key: "plan", name: "Plan", workspaceId: workspace.id },
    ],
  });
  return workspace.id;
};

beforeEach(async () => {
  await resetDb();
});

describe("upsertBulkContacts (real Postgres)", () => {
  test("creates a new attribute key and renames an existing one, scoped to the workspace", async () => {
    const workspaceId = await seedWorkspace("Upload");
    const otherWorkspaceId = await seedWorkspace("Other");

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
      ["ada@example.com", "grace@example.com"]
    );

    expect(result.ok).toBe(true);

    const keys = await prisma.contactAttributeKey.findMany({
      where: { workspaceId },
      select: { key: true, name: true, dataType: true },
      orderBy: { key: "asc" },
    });
    expect(keys).toEqual([
      { key: "email", name: "Email", dataType: "string" },
      { key: "plan", name: "Subscription Plan", dataType: "string" },
      { key: "seats", name: "Seats", dataType: "number" },
    ]);

    const attributes = await prisma.contactAttribute.findMany({
      where: { contact: { workspaceId }, attributeKey: { key: { in: ["plan", "seats"] } } },
      select: { value: true, valueNumber: true, attributeKey: { select: { key: true } } },
    });
    const stored = attributes
      .map((a) => `${a.attributeKey.key}=${a.value}${a.valueNumber === null ? "" : `#${a.valueNumber}`}`)
      .sort();
    expect(stored).toEqual(["plan=gold", "plan=silver", "seats=42#42", "seats=7#7"]);

    // The rename and the new key stay inside the uploading workspace.
    const otherKeys = await prisma.contactAttributeKey.findMany({
      where: { workspaceId: otherWorkspaceId },
      select: { key: true, name: true },
      orderBy: { key: "asc" },
    });
    expect(otherKeys).toEqual([
      { key: "email", name: "Email" },
      { key: "plan", name: "Plan" },
    ]);
  });
});
