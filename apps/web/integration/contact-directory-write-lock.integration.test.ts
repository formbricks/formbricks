import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import { createWorkspaceWithContactDirectory } from "@/integration/contact-directory-fixture";
import { waitForBlockOn } from "@/integration/postgres-locks";
import { resetDb } from "@/integration/reset-db";
import { createContactAttributeKey as createKeyV1 } from "@/modules/ee/contacts/api/v1/management/contact-attribute-keys/lib/contact-attribute-keys";
import { createContact as createContactV2 } from "@/modules/ee/contacts/api/v2/management/contacts/lib/contact";
import { updateContactAttributeKey } from "@/modules/ee/contacts/lib/contact-attribute-keys";
import { ContactDirectoryMissingError } from "@/modules/ee/contacts/lib/contact-directory";
import { createContactsFromCSV } from "@/modules/ee/contacts/lib/contacts-csv-upload";

/**
 * Writes that depend on "this workspace is in directory D" check it under the workspace's row lock, in
 * the transaction that writes (`withWorkspaceDirectory`). A directory save that removes the workspace
 * holds the same row `FOR UPDATE`, so a write either waits for it and is refused, or lands before it.
 * Only real Postgres shows the wait; the unit suites mock the client.
 */
describe("writes and a directory removal", () => {
  let workspaceId: string;
  let directoryId: string;

  /** What a directory save does to a removed workspace, in its own transaction. */
  const removeFromDirectory = (tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0]) =>
    tx.$executeRaw`UPDATE "Workspace" SET "contactDirectoryId" = NULL WHERE "id" = ${workspaceId}`;

  beforeEach(async () => {
    await resetDb();
    const organization = await prisma.organization.create({ data: { name: "Lock Org" } });
    ({ workspaceId, directoryId } = await createWorkspaceWithContactDirectory(organization.id, "W"));
  });

  /**
   * Starts `write` while a directory save holds the workspace's row and removes it, waits until the
   * write is queued behind that lock, then commits the removal. Returns the write's outcome.
   */
  const duringRemoval = async <T>(write: () => Promise<T>): Promise<PromiseSettledResult<T>> => {
    let pending: Promise<PromiseSettledResult<T>> | undefined;
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM "Workspace" WHERE "id" = ${workspaceId} FOR UPDATE`;
      await removeFromDirectory(tx);
      pending = Promise.allSettled([write()]).then(([outcome]) => outcome);
      await waitForBlockOn(tx);
    });
    return pending!;
  };

  test("a key create that starts during the removal waits for it, then creates nothing", async () => {
    const outcome = await duringRemoval(() => createKeyV1(workspaceId, { key: "plan", type: "custom" }));

    expect(outcome.status).toBe("rejected");
    if (outcome.status === "rejected") expect(outcome.reason).toBeInstanceOf(ContactDirectoryMissingError);
    expect(await prisma.contactAttributeKey.count({ where: { directoryId, key: "plan" } })).toBe(0);
  });

  test("a contact create checked against the old directory inserts nothing after the removal", async () => {
    await prisma.contactAttributeKey.create({
      data: { key: "email", name: "Email", type: "default", isUnique: true, directoryId },
    });
    const directory = { id: directoryId, matchingKey: "email" as const };

    const outcome = await duringRemoval(() =>
      createContactV2({ workspaceId, attributes: { email: "late@example.com" } }, directory)
    );

    expect(outcome.status === "fulfilled" && outcome.value.ok).toBe(false);
    expect(await prisma.contact.count({ where: { directoryId } })).toBe(0);
  });

  test("a key edit that starts during the removal is refused", async () => {
    const key = await prisma.contactAttributeKey.create({
      data: { key: "plan", name: "Plan", type: "custom", directoryId, workspaceId },
      select: { id: true },
    });

    const outcome = await duringRemoval(() =>
      updateContactAttributeKey(key.id, workspaceId, { name: "Changed" })
    );

    expect(outcome.status).toBe("rejected");
    if (outcome.status === "rejected") expect(outcome.reason).toBeInstanceOf(ResourceNotFoundError);
    expect((await prisma.contactAttributeKey.findUniqueOrThrow({ where: { id: key.id } })).name).toBe("Plan");
  });

  test("a CSV import read before the removal writes no contact after it", async () => {
    const directory = { id: directoryId, matchingKey: "email" as const };
    await prisma.workspace.update({ where: { id: workspaceId }, data: { contactDirectoryId: null } });

    await expect(
      createContactsFromCSV([{ email: "late@example.com" }], workspaceId, directory, "update", {})
    ).rejects.toBeInstanceOf(ContactDirectoryMissingError);
    expect(await prisma.contact.count({ where: { directoryId } })).toBe(0);
  });
});
