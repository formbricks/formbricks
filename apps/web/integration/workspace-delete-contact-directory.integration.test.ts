import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import {
  createWorkspaceOnContactDirectory,
  createWorkspaceWithContactDirectory,
} from "@/integration/contact-directory-fixture";
import { resetDb } from "@/integration/reset-db";
import { getContactDirectoryEmptiedOnDelete } from "@/modules/workspaces/settings/general/lib/contact-directory-emptied-on-delete";
import { deleteWorkspaceIfNotLast } from "@/modules/workspaces/settings/lib/workspace";

// Post-commit side effects of a workspace delete, outside what this test checks.
vi.mock("@/lib/authzed/projection-boundary", () => ({ runPostCommitProjection: vi.fn() }));
vi.mock("@/modules/storage/service", () => ({
  deleteFile: vi.fn(),
  deleteWorkspaceFilesBestEffort: vi.fn(),
}));

/**
 * Deleting a workspace never archives its contact directory, even when it was the directory's last
 * workspace, and keeps the directory's contacts either way (decision 6, ADR 0062). Only real Postgres
 * shows that no trigger archives it; the delete dialog's note reads the "last workspace" condition.
 *
 * Layout: workspace A alone on directory D1; workspaces B and C share directory D2.
 */
describe("deleting a workspace and its contact directory", () => {
  let organizationId: string;
  let workspaceA: string;
  let directory1: string;
  let workspaceB: string;
  let directory2: string;

  const directory = (id: string) =>
    prisma.contactDirectory.findUnique({ where: { id }, select: { isArchived: true } });
  const contactsOf = (directoryId: string) =>
    prisma.contact.findMany({ where: { directoryId }, select: { workspaceId: true } });

  beforeEach(async () => {
    await resetDb();
    organizationId = (await prisma.organization.create({ data: { name: "Directory Org" } })).id;
    ({ workspaceId: workspaceA, directoryId: directory1 } = await createWorkspaceWithContactDirectory(
      organizationId,
      "A"
    ));
    ({ workspaceId: workspaceB, directoryId: directory2 } = await createWorkspaceWithContactDirectory(
      organizationId,
      "B"
    ));
    await createWorkspaceOnContactDirectory(organizationId, directory2, "C");
    await prisma.contact.createMany({
      data: [
        { workspaceId: workspaceA, directoryId: directory1 },
        { workspaceId: workspaceB, directoryId: directory2 },
      ],
    });
  });

  test("deleting the last workspace of a directory leaves it active with no workspaces and keeps its contacts", async () => {
    expect(await getContactDirectoryEmptiedOnDelete(workspaceA)).toBe("A");

    await deleteWorkspaceIfNotLast(workspaceA, organizationId);

    expect(await directory(directory1)).toEqual({ isArchived: false });
    expect(await prisma.workspace.count({ where: { contactDirectoryId: directory1 } })).toBe(0);
    expect(await contactsOf(directory1)).toEqual([{ workspaceId: null }]);
  });

  test("deleting one of two workspaces leaves the directory active", async () => {
    expect(await getContactDirectoryEmptiedOnDelete(workspaceB)).toBeNull();

    await deleteWorkspaceIfNotLast(workspaceB, organizationId);

    expect(await directory(directory2)).toEqual({ isArchived: false });
    expect(await contactsOf(directory2)).toEqual([{ workspaceId: null }]);
  });

  test("a contact still waiting for the backfill moves into the directory instead of being deleted", async () => {
    // The fill trigger sets the directory on insert; clearing it is how the backfill window looks.
    const waiting = await prisma.contact.create({ data: { workspaceId: workspaceA }, select: { id: true } });
    await prisma.contact.update({ where: { id: waiting.id }, data: { directoryId: null } });

    await deleteWorkspaceIfNotLast(workspaceA, organizationId);

    expect(
      await prisma.contact.findUnique({ where: { id: waiting.id }, select: { directoryId: true } })
    ).toEqual({ directoryId: directory1 });
    expect(await contactsOf(directory1)).toHaveLength(2);
  });
});
