import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { getResponsesForSummary } from "@/app/(app)/workspaces/[workspaceId]/surveys/[surveyId]/(analysis)/summary/lib/surveySummary";
import { createWorkspaceWithContactDirectory } from "@/integration/contact-directory-fixture";
import { resetDb } from "@/integration/reset-db";
import { getResponseWithQuotas, getResponses } from "@/lib/response/service";

/**
 * Old responses of a contact the workspace no longer reaches (decision 8, ADR 0061), against real Postgres:
 * the app's results mark the contact unavailable, without its current userId, when it sits in another
 * contact directory or the workspace has none. The v1 management read (no option) is unchanged.
 */

// The response card asks the licence service about quotas, which a node test cannot reach.
vi.mock("@/modules/ee/license-check/lib/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/modules/ee/license-check/lib/utils")>()),
  getIsQuotasEnabled: async () => false,
}));

beforeEach(async () => {
  await resetDb();
});

const seed = async () => {
  const organization = await prisma.organization.create({ data: { name: "Results Org" } });
  const { workspaceId, directoryId } = await createWorkspaceWithContactDirectory(organization.id, "Current");
  // The directory the workspace used before: its contacts keep their responses in the workspace's survey.
  const { directoryId: oldDirectoryId } = await createWorkspaceWithContactDirectory(organization.id, "Old");

  const createContactWithUserId = async (contactDirectoryId: string, userId: string) => {
    const key = await prisma.contactAttributeKey.upsert({
      where: { directoryId_key: { directoryId: contactDirectoryId, key: "userId" } },
      create: { key: "userId", name: "User ID", type: "default", directoryId: contactDirectoryId },
      update: {},
      select: { id: true },
    });
    const contact = await prisma.contact.create({
      data: { directoryId: contactDirectoryId, workspaceId },
      select: { id: true },
    });
    await prisma.contactAttribute.create({
      data: { contactId: contact.id, attributeKeyId: key.id, value: userId },
    });
    return contact.id;
  };

  const reachableContact = await createContactWithUserId(directoryId, "user-in");
  const oldContact = await createContactWithUserId(oldDirectoryId, "user-old");

  const survey = await prisma.survey.create({
    data: { name: "App survey", type: "app", status: "inProgress", workspaceId },
    select: { id: true },
  });
  const createResponse = async (contactId: string | null, createdAt: Date) =>
    (
      await prisma.response.create({
        data: {
          surveyId: survey.id,
          contactId,
          createdAt,
          finished: true,
          data: {},
          contactAttributes: { userId: "saved" },
        },
        select: { id: true },
      })
    ).id;

  const reachableResponse = await createResponse(reachableContact, new Date("2026-11-03T00:00:00Z"));
  const oldResponse = await createResponse(oldContact, new Date("2026-11-02T00:00:00Z"));
  const anonymousResponse = await createResponse(null, new Date("2026-11-01T00:00:00Z"));

  return {
    workspaceId,
    surveyId: survey.id,
    reachableContact,
    oldContact,
    reachableResponse,
    oldResponse,
    anonymousResponse,
  };
};

const contactsById = (rows: { id: string; contact: unknown }[]) =>
  Object.fromEntries(rows.map((row) => [row.id, row.contact]));

describe("the app's results mark contacts the workspace no longer reaches", () => {
  test("a contact of another directory is unavailable and comes without its userId", async () => {
    const layout = await seed();

    const responses = await getResponses(layout.surveyId, 10, 0, undefined, undefined, {
      withContactAvailability: true,
    });
    expect(contactsById(responses)).toEqual({
      [layout.reachableResponse]: { id: layout.reachableContact, userId: "user-in" },
      [layout.oldResponse]: { id: layout.oldContact, unavailable: true },
      [layout.anonymousResponse]: null,
    });

    const summaryRows = await getResponsesForSummary(layout.surveyId, 10);
    expect(contactsById(summaryRows)).toEqual(contactsById(responses));

    await expect(getResponseWithQuotas(layout.oldResponse)).resolves.toMatchObject({
      contact: { id: layout.oldContact, unavailable: true },
    });
    const card = await getResponseWithQuotas(layout.reachableResponse);
    expect(card?.contact).toEqual({ id: layout.reachableContact, userId: "user-in" });
  });

  test("every contact is unavailable once the workspace has no directory", async () => {
    const layout = await seed();
    await prisma.workspace.update({
      where: { id: layout.workspaceId },
      data: { contactDirectoryId: null },
    });

    const responses = await getResponses(layout.surveyId, 10, 0, undefined, undefined, {
      withContactAvailability: true,
    });
    expect(contactsById(responses)).toEqual({
      [layout.reachableResponse]: { id: layout.reachableContact, unavailable: true },
      [layout.oldResponse]: { id: layout.oldContact, unavailable: true },
      [layout.anonymousResponse]: null,
    });

    const summaryRows = await getResponsesForSummary(layout.surveyId, 10);
    expect(contactsById(summaryRows)).toEqual(contactsById(responses));

    const card = await getResponseWithQuotas(layout.reachableResponse);
    expect(card?.contact).toEqual({ id: layout.reachableContact, unavailable: true });
  });

  test("the v1 management read, which asks for no availability, is unchanged", async () => {
    const layout = await seed();

    const responses = await getResponses(layout.surveyId, 10, 0);
    expect(contactsById(responses)[layout.oldResponse]).toEqual({
      id: layout.oldContact,
      userId: "user-old",
    });
  });
});
