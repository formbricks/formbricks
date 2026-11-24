import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { updateUser } from "@/modules/ee/contacts/api/v1/client/[workspaceId]/user/lib/update-user";
import { ContactDirectoryMissingError } from "@/modules/ee/contacts/lib/contact-directory";
import { ContactDirectoryWorkspacesNotMovableError } from "./directory-errors";
import { createContactDirectory, updateContactDirectory } from "./directory-service";

/**
 * ENG-7498: a workspace with no contact directory, and what changes when it gets one. Real Postgres,
 * because the behaviour lives in the rolling-deploy trigger (it leaves `directoryId` empty for such a
 * workspace) and in the unique keys a key merge has to respect.
 */

beforeEach(async () => {
  await resetDb();
});

const createOrganization = async () =>
  (await prisma.organization.create({ data: { name: "ENG-7498 org" }, select: { id: true } })).id;

/** A workspace as `createWorkspace` makes it now: no directory, no keys (decisions 3 and 25). */
const createWorkspaceWithoutDirectory = async (organizationId: string, name = "No directory") =>
  (await prisma.workspace.create({ data: { name, organizationId }, select: { id: true } })).id;

/** A key a pod of the previous release created: only a `workspaceId`, so the trigger leaves no directory. */
const createOrphanKey = (workspaceId: string, key: string) =>
  prisma.contactAttributeKey.create({ data: { key, name: key, workspaceId }, select: { id: true } });

/** A contact with values on the given keys, as a pod of the previous release writes it. */
const createOrphanContact = async (workspaceId: string, values: { keyId: string; value: string }[]) =>
  prisma.contact.create({
    data: {
      workspaceId,
      attributes: { create: values.map(({ keyId, value }) => ({ attributeKeyId: keyId, value })) },
    },
    select: { id: true },
  });

const createSurveyFilteringOn = (workspaceId: string, attributeKeyId: string) =>
  prisma.survey.create({
    data: {
      name: "Filtered survey",
      workspaceId,
      type: "app",
      status: "draft",
      attributeFilters: { create: { attributeKeyId, condition: "equals", value: "pro" } },
    },
    select: { id: true },
  });

const attributesOf = (contactId: string) =>
  prisma.contactAttribute.findMany({
    where: { contactId },
    select: { value: true, attributeKey: { select: { key: true, directoryId: true, workspaceId: true } } },
    orderBy: { value: "asc" },
  });

describe("a workspace without a contact directory", () => {
  test("refuses identify until a directory is assigned, then works right away", async () => {
    const organizationId = await createOrganization();
    const workspaceId = await createWorkspaceWithoutDirectory(organizationId);

    await expect(updateUser(workspaceId, "user-1", "desktop")).rejects.toBeInstanceOf(
      ContactDirectoryMissingError
    );
    expect(await prisma.contact.count()).toBe(0);

    const { id: directoryId } = await createContactDirectory({
      organizationId,
      name: "Customers",
      matchingKey: "email",
      workspaceIds: [workspaceId],
    });

    const result = await updateUser(workspaceId, "user-1", "desktop");

    const contact = await prisma.contact.findFirstOrThrow({ select: { id: true, directoryId: true } });
    expect(result.state.data?.contactId).toBe(contact.id);
    expect(contact.directoryId).toBe(directoryId);
  });

  test("its first directory adopts the contacts, keys and segments a previous-release pod wrote", async () => {
    const organizationId = await createOrganization();
    const workspaceId = await createWorkspaceWithoutDirectory(organizationId);
    const email = await createOrphanKey(workspaceId, "email");
    const plan = await createOrphanKey(workspaceId, "plan");
    const contact = await createOrphanContact(workspaceId, [
      { keyId: email.id, value: "a@example.com" },
      { keyId: plan.id, value: "pro" },
    ]);
    const survey = await createSurveyFilteringOn(workspaceId, email.id);
    const segment = await prisma.segment.create({
      data: { title: "VIP", isPrivate: false, filters: [], workspaceId },
      select: { id: true },
    });

    const { id: directoryId } = await createContactDirectory({
      organizationId,
      name: "Customers",
      matchingKey: "email",
      workspaceIds: [workspaceId],
    });

    expect(await prisma.contact.findUniqueOrThrow({ where: { id: contact.id } })).toMatchObject({
      directoryId,
    });
    // `email` merged into the directory's own default key (no workspace of origin); `plan` joined as is.
    expect(await attributesOf(contact.id)).toEqual([
      { value: "a@example.com", attributeKey: { key: "email", directoryId, workspaceId: null } },
      { value: "pro", attributeKey: { key: "plan", directoryId, workspaceId } },
    ]);
    expect(await prisma.contactAttributeKey.findUnique({ where: { id: email.id } })).toBeNull();
    const filter = await prisma.surveyAttributeFilter.findFirstOrThrow({
      where: { surveyId: survey.id },
      select: { attributeKey: { select: { key: true, directoryId: true } } },
    });
    expect(filter.attributeKey).toEqual({ key: "email", directoryId });
    expect(await prisma.segment.findUniqueOrThrow({ where: { id: segment.id } })).toMatchObject({
      directoryId,
    });
  });

  test("joining a directory in use merges keys by name and leaves a segment whose title is taken", async () => {
    const organizationId = await createOrganization();
    const firstWorkspaceId = await createWorkspaceWithoutDirectory(organizationId, "First");
    const { id: directoryId } = await createContactDirectory({
      organizationId,
      name: "Customers",
      matchingKey: "email",
      workspaceIds: [firstWorkspaceId],
    });
    const directoryPlan = await prisma.contactAttributeKey.create({
      data: { key: "plan", name: "Plan", directoryId, workspaceId: firstWorkspaceId },
      select: { id: true },
    });
    await prisma.segment.create({
      data: { title: "VIP", isPrivate: false, filters: [], workspaceId: firstWorkspaceId },
    });

    const workspaceId = await createWorkspaceWithoutDirectory(organizationId, "Second");
    const plan = await createOrphanKey(workspaceId, "plan");
    const contact = await createOrphanContact(workspaceId, [{ keyId: plan.id, value: "pro" }]);
    const survey = await createSurveyFilteringOn(workspaceId, plan.id);
    const segment = await prisma.segment.create({
      data: { title: "VIP", isPrivate: false, filters: [], workspaceId },
      select: { id: true },
    });

    await updateContactDirectory({
      organizationId,
      directoryId,
      workspaceIds: [firstWorkspaceId, workspaceId],
    });

    const attribute = await prisma.contactAttribute.findFirstOrThrow({ where: { contactId: contact.id } });
    expect(attribute.attributeKeyId).toBe(directoryPlan.id);
    const filter = await prisma.surveyAttributeFilter.findFirstOrThrow({ where: { surveyId: survey.id } });
    expect(filter.attributeKeyId).toBe(directoryPlan.id);
    expect(await prisma.contactAttributeKey.findUnique({ where: { id: plan.id } })).toBeNull();
    expect(await prisma.segment.findUniqueOrThrow({ where: { id: segment.id } })).toMatchObject({
      directoryId: null,
    });
  });
});

describe("moving a workspace never merges contacts", () => {
  // Decision 15: no merge in this release. A workspace that brings contacts may join a directory only
  // while that directory has none.
  test("refuses a directoryless workspace with contacts into a directory that has contacts", async () => {
    const organizationId = await createOrganization();
    const firstWorkspaceId = await createWorkspaceWithoutDirectory(organizationId, "First");
    const { id: directoryId } = await createContactDirectory({
      organizationId,
      name: "Customers",
      matchingKey: "email",
      workspaceIds: [firstWorkspaceId],
    });
    await prisma.contact.create({ data: { workspaceId: firstWorkspaceId, directoryId } });

    const workspaceId = await createWorkspaceWithoutDirectory(organizationId, "Second");
    const orphan = await createOrphanContact(workspaceId, []);

    await expect(
      updateContactDirectory({ organizationId, directoryId, workspaceIds: [firstWorkspaceId, workspaceId] })
    ).rejects.toBeInstanceOf(ContactDirectoryWorkspacesNotMovableError);

    expect(await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).toMatchObject({
      contactDirectoryId: null,
    });
    expect(await prisma.contact.findUniqueOrThrow({ where: { id: orphan.id } })).toMatchObject({
      directoryId: null,
    });
  });
});

describe("a survey's private segment keeps its keys when its workspace moves", () => {
  const filterOn = (contactAttributeKey: string) => [
    {
      id: "filter-1",
      connector: null,
      resource: {
        id: "resource-1",
        root: { type: "attribute", contactAttributeKey },
        value: "x",
        qualifier: { operator: "equals" },
      },
    },
  ];

  test("refuses moving a segment filtering on externalId into an email directory", async () => {
    const organizationId = await createOrganization();
    const workspaceId = await createWorkspaceWithoutDirectory(organizationId);
    const { id: oldDirectoryId } = await createContactDirectory({
      organizationId,
      name: "Old",
      matchingKey: "externalId",
      workspaceIds: [workspaceId],
    });
    await prisma.segment.create({
      data: {
        title: "survey-id",
        isPrivate: true,
        filters: filterOn("externalId"),
        workspaceId,
        directoryId: oldDirectoryId,
      },
    });

    await expect(
      createContactDirectory({
        organizationId,
        name: "New",
        matchingKey: "email",
        workspaceIds: [workspaceId],
      })
    ).rejects.toBeInstanceOf(ContactDirectoryWorkspacesNotMovableError);
    expect(await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } })).toMatchObject({
      contactDirectoryId: oldDirectoryId,
    });
  });

  test("moves a segment filtering on externalId into another external-ID directory", async () => {
    const organizationId = await createOrganization();
    const workspaceId = await createWorkspaceWithoutDirectory(organizationId);
    await createContactDirectory({
      organizationId,
      name: "Old",
      matchingKey: "externalId",
      workspaceIds: [workspaceId],
    });
    const segment = await prisma.segment.create({
      data: {
        title: "survey-id",
        isPrivate: true,
        filters: filterOn("externalId"),
        workspaceId,
        directoryId: (await prisma.workspace.findUniqueOrThrow({ where: { id: workspaceId } }))
          .contactDirectoryId,
      },
      select: { id: true },
    });

    const { id: directoryId } = await createContactDirectory({
      organizationId,
      name: "New",
      matchingKey: "externalId",
      workspaceIds: [workspaceId],
    });

    expect(await prisma.segment.findUniqueOrThrow({ where: { id: segment.id } })).toMatchObject({
      directoryId,
    });
  });
});
