import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import {
  createWorkspaceOnContactDirectory,
  createWorkspaceWithContactDirectory,
} from "@/integration/contact-directory-fixture";
import { resetDb } from "@/integration/reset-db";
import { updateAttributes } from "@/modules/ee/contacts/lib/attributes";
import { ContactDirectoryMissingError } from "@/modules/ee/contacts/lib/contact-directory";
import { updateUser } from "./update-user";

/**
 * ENG-7493: SDK identify (`setUserId`, `setAttribute(s)`) finds and creates contacts in the workspace's
 * contact directory. Real Postgres, because the behaviour lives in the directory unique key, the
 * rolling-deploy trigger and the relation filters, none of which a mock can show.
 */

const USER_ID = "eng-7493-user";

beforeEach(async () => {
  await resetDb();
});

const createOrganization = async () =>
  (await prisma.organization.create({ data: { name: "ENG-7493 org" }, select: { id: true } })).id;

/** The `userId` key as the migration leaves it: created by the workspace, its directory filled in. */
const createMigratedUserIdKey = (workspaceId: string) =>
  prisma.contactAttributeKey.create({
    data: { key: "userId", name: "User Id", type: "default", isUnique: true, workspaceId },
  });

/** The default keys of a directory made after the upgrade: on the directory, with no workspace (decision 25). */
const createDirectoryDefaultKeys = (directoryId: string) =>
  prisma.contactAttributeKey.createMany({
    data: ["userId", "email"].map((key) => ({ key, name: key, type: "default" as const, directoryId })),
  });

describe("updateUser through the contact directory", () => {
  test("a migrated workspace's identify returns what it did before", async () => {
    const organizationId = await createOrganization();
    const { workspaceId, directoryId } = await createWorkspaceWithContactDirectory(organizationId);
    await createMigratedUserIdKey(workspaceId);

    const first = await updateUser(workspaceId, USER_ID, "desktop");
    const contact = await prisma.contact.findFirstOrThrow({
      select: { id: true, workspaceId: true, directoryId: true },
    });

    expect(first.state.data).toEqual({
      contactId: contact.id,
      userId: USER_ID,
      segments: [],
      displays: [],
      responses: [],
      lastDisplayAt: null,
      language: undefined,
    });
    expect(first.messages).toBeUndefined();
    expect(first.errors).toBeUndefined();
    expect(contact).toEqual({ id: contact.id, workspaceId, directoryId });

    // A repeat identify finds the same contact; `de` is stored canonically and echoed in its legacy form.
    const second = await updateUser(workspaceId, USER_ID, "desktop", { language: "de" });

    expect(second.state.data).toEqual({ ...first.state.data, language: "de" });
    expect(await prisma.contact.count()).toBe(1);
  });

  test("the same userId from two workspaces of a shared directory is one contact", async () => {
    const organizationId = await createOrganization();
    const { workspaceId, directoryId } = await createWorkspaceWithContactDirectory(organizationId);
    await createMigratedUserIdKey(workspaceId);
    const secondWorkspaceId = await createWorkspaceOnContactDirectory(organizationId, directoryId);

    const fromFirst = await updateUser(workspaceId, USER_ID, "desktop");
    const fromSecond = await updateUser(secondWorkspaceId, USER_ID, "phone");

    expect(fromSecond.state.data?.contactId).toBe(fromFirst.state.data?.contactId);
    // The contact keeps the workspace it was created from.
    expect(await prisma.contact.findMany({ select: { workspaceId: true, directoryId: true } })).toEqual([
      { workspaceId, directoryId },
    ]);
  });

  // Decision 12: a directory made in settings has default keys with no workspace; the old
  // (key, workspaceId) connect would fail for every one of its workspaces.
  test("connects the directory's default userId key, which has no workspace", async () => {
    const organizationId = await createOrganization();
    const { workspaceId, directoryId } = await createWorkspaceWithContactDirectory(organizationId);
    await createDirectoryDefaultKeys(directoryId);

    const result = await updateUser(workspaceId, USER_ID, "desktop", { email: "first@example.com" });

    expect(result.state.data?.userId).toBe(USER_ID);
    const attributes = await prisma.contactAttribute.findMany({
      where: { contactId: result.state.data?.contactId ?? "" },
      select: { value: true, attributeKey: { select: { key: true, workspaceId: true } } },
      orderBy: { attributeKey: { key: "asc" } },
    });
    expect(attributes).toEqual([
      { value: "first@example.com", attributeKey: { key: "email", workspaceId: null } },
      { value: USER_ID, attributeKey: { key: "userId", workspaceId: null } },
    ]);
  });

  test("a new key from setAttribute(s) is created on the directory, with the sending workspace as origin", async () => {
    const organizationId = await createOrganization();
    const { workspaceId, directoryId } = await createWorkspaceWithContactDirectory(organizationId);
    await createMigratedUserIdKey(workspaceId);
    const secondWorkspaceId = await createWorkspaceOnContactDirectory(organizationId, directoryId);
    await updateUser(workspaceId, USER_ID, "desktop");

    const result = await updateUser(secondWorkspaceId, USER_ID, "desktop", { plan: "pro" });

    expect(result.errors).toBeUndefined();
    expect(
      await prisma.contactAttributeKey.findMany({
        where: { key: "plan" },
        select: { directoryId: true, workspaceId: true },
      })
    ).toEqual([{ directoryId, workspaceId: secondWorkspaceId }]);

    // The first workspace sees and reuses that key instead of creating its own.
    await updateUser(workspaceId, USER_ID, "desktop", { plan: "enterprise" });
    expect(await prisma.contactAttributeKey.count({ where: { key: "plan" } })).toBe(1);
    expect(
      await prisma.contactAttribute.findMany({
        where: { attributeKey: { key: "plan" } },
        select: { value: true },
      })
    ).toEqual([{ value: "enterprise" }]);
  });

  test("the email and userId checks count contacts across the whole directory", async () => {
    const organizationId = await createOrganization();
    const { workspaceId, directoryId } = await createWorkspaceWithContactDirectory(organizationId);
    await createDirectoryDefaultKeys(directoryId);
    const secondWorkspaceId = await createWorkspaceOnContactDirectory(organizationId, directoryId);
    await updateUser(workspaceId, "owner-of-the-email", "desktop", { email: "taken@example.com" });
    const other = await updateUser(secondWorkspaceId, USER_ID, "desktop");
    const otherContactId = other.state.data?.contactId ?? "";

    const result = await updateAttributes(otherContactId, USER_ID, secondWorkspaceId, {
      email: "taken@example.com",
      userId: "owner-of-the-email",
    });

    expect(result.messages?.map(({ code }) => code)).toEqual(
      expect.arrayContaining(["email_already_exists", "userid_already_exists"])
    );
    expect(
      await prisma.contactAttribute.count({
        where: { contactId: otherContactId, attributeKey: { key: "email" } },
      })
    ).toBe(0);
  });

  test("a workspace with no directory gets the no-directory error and nothing is created", async () => {
    const organizationId = await createOrganization();
    const workspace = await prisma.workspace.create({
      data: { name: "No directory", organizationId },
      select: { id: true },
    });

    await expect(updateUser(workspace.id, USER_ID, "desktop", { plan: "pro" })).rejects.toThrow(
      ContactDirectoryMissingError
    );
    expect(await prisma.contact.count()).toBe(0);
    expect(await prisma.contactAttributeKey.count()).toBe(0);
  });
});
