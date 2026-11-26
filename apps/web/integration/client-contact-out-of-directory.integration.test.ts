import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { createDisplay } from "@/app/api/v2/client/[workspaceId]/displays/lib/display";
import { createResponseWithQuotaEvaluation } from "@/app/api/v2/client/[workspaceId]/responses/lib/response";
import { createWorkspaceWithContactDirectory } from "@/integration/contact-directory-fixture";
import { resetDb } from "@/integration/reset-db";

/**
 * Decision 7: a v2 client response or display that names a contact the workspace can't reach (its
 * workspace left the directory, or the contact is in another directory) is still saved, but with no
 * contact and no contact attributes. Only a real database shows what the directory-scoped lookup
 * actually finds.
 */

beforeEach(async () => {
  await resetDb();
});

const seed = async () => {
  const organization = await prisma.organization.create({ data: { name: "Out of directory org" } });
  const { workspaceId, directoryId } = await createWorkspaceWithContactDirectory(organization.id, "Own");
  const email = await prisma.contactAttributeKey.create({
    data: { key: "email", name: "Email", type: "default", isUnique: true, directoryId },
    select: { id: true },
  });
  const contact = await prisma.contact.create({
    data: {
      workspaceId,
      directoryId,
      attributes: { create: [{ attributeKeyId: email.id, value: "ann@example.com" }] },
    },
    select: { id: true },
  });
  const survey = await prisma.survey.create({
    data: { name: "Survey", type: "app", status: "inProgress", workspaceId },
    select: { id: true },
  });
  return { organizationId: organization.id, workspaceId, contactId: contact.id, surveyId: survey.id };
};

const respond = (workspaceId: string, surveyId: string, contactId: string) =>
  createResponseWithQuotaEvaluation({
    workspaceId,
    surveyId,
    contactId,
    displayId: null,
    finished: true,
    data: {},
    meta: {},
    ttc: {},
    singleUseId: null,
    variables: {},
  });

const storedResponse = (id: string) =>
  prisma.response.findUnique({ where: { id }, select: { contactId: true, contactAttributes: true } });

const storedDisplay = (id: string) =>
  prisma.display.findUnique({ where: { id }, select: { contactId: true } });

describe("v2 client writes for a contact outside the workspace's directory (decision 7)", () => {
  test("a contact of the workspace's directory is linked, with its attributes", async () => {
    const { workspaceId, contactId, surveyId } = await seed();

    const response = await respond(workspaceId, surveyId, contactId);
    const display = await createDisplay({ workspaceId, surveyId, contactId });

    await expect(storedResponse(response.id)).resolves.toEqual({
      contactId,
      contactAttributes: { email: "ann@example.com" },
    });
    await expect(storedDisplay(display.id)).resolves.toEqual({ contactId });
  });

  test("after the workspace leaves its directory, the response and display are saved without the contact", async () => {
    const { workspaceId, contactId, surveyId } = await seed();
    await prisma.workspace.update({ where: { id: workspaceId }, data: { contactDirectoryId: null } });

    const response = await respond(workspaceId, surveyId, contactId);
    const display = await createDisplay({ workspaceId, surveyId, contactId });

    expect(response.contact).toBeNull();
    await expect(storedResponse(response.id)).resolves.toEqual({ contactId: null, contactAttributes: null });
    await expect(storedDisplay(display.id)).resolves.toEqual({ contactId: null });
  });

  test("a contact of another directory is not linked", async () => {
    const { organizationId, contactId } = await seed();
    const other = await createWorkspaceWithContactDirectory(organizationId, "Other");
    const otherSurvey = await prisma.survey.create({
      data: { name: "Other survey", type: "app", status: "inProgress", workspaceId: other.workspaceId },
      select: { id: true },
    });

    const response = await respond(other.workspaceId, otherSurvey.id, contactId);
    const display = await createDisplay({
      workspaceId: other.workspaceId,
      surveyId: otherSurvey.id,
      contactId,
    });

    await expect(storedResponse(response.id)).resolves.toEqual({ contactId: null, contactAttributes: null });
    await expect(storedDisplay(display.id)).resolves.toEqual({ contactId: null });
  });
});
