import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { ResourceNotFoundError } from "@formbricks/types/errors";
import {
  createWorkspaceOnContactDirectory,
  createWorkspaceWithContactDirectory,
} from "@/integration/contact-directory-fixture";
import { resetDb } from "@/integration/reset-db";
import { getDisplaysByContactId } from "@/lib/display/service";
import { getResponsesByContactId } from "@/lib/response/service";
import { getContactAttributeKeys as getV2ContactAttributeKeys } from "@/modules/api/v2/management/contact-attribute-keys/lib/contact-attribute-key";
import { getContactAttributeKeys as getV1ContactAttributeKeys } from "@/modules/ee/contacts/api/v1/management/contact-attribute-keys/lib/contact-attribute-keys";
import { getContacts as getV1Contacts } from "@/modules/ee/contacts/api/v1/management/contacts/lib/contacts";
import {
  getContactAttributeKeyById,
  getContactAttributeKeys,
} from "@/modules/ee/contacts/lib/contact-attribute-keys";
import {
  ContactInSharedDirectoryError,
  buildContactWhereClause,
  deleteContactInWorkspace,
  getContactInWorkspace,
} from "@/modules/ee/contacts/lib/contacts";

/**
 * Contact and attribute key reads, access and delete go through the workspace's contact directory
 * (ENG-7495, decisions 7, 9 and 16), against real Postgres: whether a relation filter through
 * `directory.workspaces` matches the rows it should is a question only the database settles.
 *
 * Layout: workspaces A and B share directory D1; C (same organization) has D2; X (another
 * organization) has D3.
 */

type TLayout = {
  workspaceA: string;
  workspaceB: string;
  workspaceC: string;
  workspaceX: string;
  directory1: string;
  contactFromA: string;
  contactWithoutOrigin: string;
  contactOfC: string;
  contactOfX: string;
  defaultKey: string;
  customKeyFromA: string;
  keyOfC: string;
};

const seed = async (): Promise<TLayout> => {
  const organization = await prisma.organization.create({ data: { name: "Directory Org" } });
  const otherOrganization = await prisma.organization.create({ data: { name: "Other Org" } });

  const { workspaceId: workspaceA, directoryId: directory1 } = await createWorkspaceWithContactDirectory(
    organization.id,
    "A"
  );
  const workspaceB = await createWorkspaceOnContactDirectory(organization.id, directory1, "B");
  const { workspaceId: workspaceC, directoryId: directory2 } = await createWorkspaceWithContactDirectory(
    organization.id,
    "C"
  );
  const { workspaceId: workspaceX, directoryId: directory3 } = await createWorkspaceWithContactDirectory(
    otherOrganization.id,
    "X"
  );

  // A directory's default keys have no origin workspace (decision 25).
  const defaultKey = await prisma.contactAttributeKey.create({
    data: { key: "email", name: "Email", type: "default", directoryId: directory1 },
    select: { id: true },
  });
  const customKeyFromA = await prisma.contactAttributeKey.create({
    data: { key: "plan", name: "Plan", directoryId: directory1, workspaceId: workspaceA },
    select: { id: true },
  });
  const keyOfC = await prisma.contactAttributeKey.create({
    data: { key: "plan", name: "Plan", directoryId: directory2, workspaceId: workspaceC },
    select: { id: true },
  });

  const createContact = async (directoryId: string, workspaceId: string | null) =>
    (await prisma.contact.create({ data: { directoryId, workspaceId }, select: { id: true } })).id;

  return {
    workspaceA,
    workspaceB,
    workspaceC,
    workspaceX,
    directory1,
    contactFromA: await createContact(directory1, workspaceA),
    // Its origin workspace was deleted; it lives on in the shared directory (decision 22).
    contactWithoutOrigin: await createContact(directory1, null),
    contactOfC: await createContact(directory2, workspaceC),
    contactOfX: await createContact(directory3, workspaceX),
    defaultKey: defaultKey.id,
    customKeyFromA: customKeyFromA.id,
    keyOfC: keyOfC.id,
  };
};

let layout: TLayout;

beforeEach(async () => {
  await resetDb();
  layout = await seed();
});

describe("contact reads", () => {
  test("a contact is reachable from every workspace on its directory", async () => {
    expect(await getContactInWorkspace(layout.contactFromA, layout.workspaceA)).not.toBeNull();
    expect(await getContactInWorkspace(layout.contactFromA, layout.workspaceB)).not.toBeNull();
  });

  test("a contact of another directory stays unreachable, in this organization or another", async () => {
    expect(await getContactInWorkspace(layout.contactOfC, layout.workspaceA)).toBeNull();
    expect(await getContactInWorkspace(layout.contactOfX, layout.workspaceA)).toBeNull();
    expect(await getContactInWorkspace(layout.contactFromA, layout.workspaceC)).toBeNull();
  });

  test("a contact with no origin workspace reports the caller's workspace", async () => {
    const contact = await getContactInWorkspace(layout.contactWithoutOrigin, layout.workspaceB);
    expect(contact?.workspaceId).toBe(layout.workspaceB);
  });

  test("every workspace on a shared directory lists the same contacts", async () => {
    const listIds = async (workspaceId: string) =>
      (
        await prisma.contact.findMany({
          where: buildContactWhereClause(workspaceId),
          select: { id: true },
          orderBy: { id: "asc" },
        })
      ).map(({ id }) => id);

    const expected = [layout.contactFromA, layout.contactWithoutOrigin].sort();
    expect(await listIds(layout.workspaceA)).toEqual(expected);
    expect(await listIds(layout.workspaceB)).toEqual(expected);
    expect(await listIds(layout.workspaceC)).toEqual([layout.contactOfC]);
  });
});

describe("attribute key reads", () => {
  test("every workspace on a shared directory lists the same keys, default keys included", async () => {
    const keysOf = async (workspaceId: string) =>
      (await getContactAttributeKeys(workspaceId)).map(({ id, workspaceId: reported }) => ({ id, reported }));

    expect(await keysOf(layout.workspaceB)).toEqual(
      expect.arrayContaining([
        { id: layout.defaultKey, reported: layout.workspaceB },
        { id: layout.customKeyFromA, reported: layout.workspaceB },
      ])
    );
    expect(await keysOf(layout.workspaceB)).toHaveLength(2);
    expect(await keysOf(layout.workspaceC)).toEqual([{ id: layout.keyOfC, reported: layout.workspaceC }]);
  });

  test("a key is reachable by id only from a workspace on its directory", async () => {
    expect(await getContactAttributeKeyById(layout.customKeyFromA, layout.workspaceB)).not.toBeNull();
    expect(await getContactAttributeKeyById(layout.customKeyFromA, layout.workspaceC)).toBeNull();
    expect(await getContactAttributeKeyById(layout.keyOfC, layout.workspaceX)).toBeNull();
  });

  test("v1 and v2 list each key once for an API key on two workspaces of one directory", async () => {
    // The lowest workspace id of the directory is the one a key is reported under.
    const reportedFor1 = [layout.workspaceA, layout.workspaceB].sort()[0];
    const expected = [
      { id: layout.defaultKey, workspaceId: reportedFor1 },
      { id: layout.customKeyFromA, workspaceId: reportedFor1 },
      { id: layout.keyOfC, workspaceId: layout.workspaceC },
    ].sort((a, b) => a.id.localeCompare(b.id));
    const workspaceIds = [layout.workspaceB, layout.workspaceA, layout.workspaceC];

    const v1 = await getV1ContactAttributeKeys(workspaceIds);
    expect(
      v1.map(({ id, workspaceId }) => ({ id, workspaceId })).sort((a, b) => a.id.localeCompare(b.id))
    ).toEqual(expected);

    const v2 = await getV2ContactAttributeKeys(workspaceIds, {
      limit: 50,
      skip: 0,
      sortBy: "createdAt",
      order: "asc",
    });
    if (!v2.ok) throw new Error("v2 key listing failed");
    expect(
      v2.data.data
        .map(({ id, workspaceId }) => ({ id, workspaceId }))
        .sort((a, b) => a.id.localeCompare(b.id))
    ).toEqual(expected);
    expect(v2.data.meta.total).toBe(3);
    // The new column stays out of the responses.
    expect(v1[0]).not.toHaveProperty("directoryId");
    expect(v2.data.data[0]).not.toHaveProperty("directoryId");
  });
});

describe("v1 GET /contacts (decision 9)", () => {
  test("returns the old shape through an explicit select, each contact once", async () => {
    const contacts = await getV1Contacts([layout.workspaceA, layout.workspaceB]);

    expect(contacts.map(({ id }) => id).sort()).toEqual(
      [layout.contactFromA, layout.contactWithoutOrigin].sort()
    );
    // A column added to Contact later must not reach v1: this list is the whole v1 contact.
    for (const contact of contacts) {
      expect(Object.keys(contact).sort()).toEqual(["createdAt", "id", "updatedAt", "workspaceId"]);
    }
    const byId = new Map(contacts.map((contact) => [contact.id, contact]));
    expect(byId.get(layout.contactFromA)?.workspaceId).toBe(layout.workspaceA);
    expect(byId.get(layout.contactWithoutOrigin)?.workspaceId).toBe(
      [layout.workspaceA, layout.workspaceB].sort()[0]
    );
  });
});

describe("contact delete (decision 9)", () => {
  test("is refused in a shared directory and deletes nothing", async () => {
    await expect(deleteContactInWorkspace(layout.contactFromA, layout.workspaceB)).rejects.toBeInstanceOf(
      ContactInSharedDirectoryError
    );
    await expect(deleteContactInWorkspace(layout.contactFromA, layout.workspaceA)).rejects.toBeInstanceOf(
      ContactInSharedDirectoryError
    );
    expect(await prisma.contact.findUnique({ where: { id: layout.contactFromA } })).not.toBeNull();
  });

  test("works as today in an unshared directory", async () => {
    const deleted = await deleteContactInWorkspace(layout.contactOfC, layout.workspaceC);

    expect(deleted.id).toBe(layout.contactOfC);
    expect(await prisma.contact.findUnique({ where: { id: layout.contactOfC } })).toBeNull();
  });

  test("does not reach a contact of another directory", async () => {
    await expect(deleteContactInWorkspace(layout.contactOfC, layout.workspaceA)).rejects.toBeInstanceOf(
      ResourceNotFoundError
    );
    expect(await prisma.contact.findUnique({ where: { id: layout.contactOfC } })).not.toBeNull();
  });
});

describe("a contact's responses and displays (decision 16)", () => {
  test("a shared directory shares contacts, not their responses or displays", async () => {
    const createSurvey = async (workspaceId: string) =>
      (
        await prisma.survey.create({
          data: { name: "Survey", type: "link", status: "inProgress", workspaceId },
          select: { id: true },
        })
      ).id;
    const surveyOfA = await createSurvey(layout.workspaceA);
    const surveyOfB = await createSurvey(layout.workspaceB);
    for (const surveyId of [surveyOfA, surveyOfB]) {
      await prisma.response.create({
        data: { surveyId, contactId: layout.contactFromA, finished: true, data: {} },
      });
      await prisma.display.create({ data: { surveyId, contactId: layout.contactFromA } });
    }

    const responsesInB = await getResponsesByContactId(layout.contactFromA, layout.workspaceB, {});
    const displaysInB = await getDisplaysByContactId(layout.contactFromA, layout.workspaceB, {});

    expect(responsesInB.map(({ surveyId }) => surveyId)).toEqual([surveyOfB]);
    expect(displaysInB.map(({ surveyId }) => surveyId)).toEqual([surveyOfB]);
    expect(await getResponsesByContactId(layout.contactFromA, layout.workspaceC, {})).toEqual([]);
  });
});
