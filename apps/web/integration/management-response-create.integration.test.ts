import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { createResponseWithQuotaEvaluation as createV1ManagementResponse } from "@/app/api/v1/management/responses/lib/response";
import { resetDb } from "@/integration/reset-db";
import { createResponseWithQuotaEvaluation as createV2ManagementResponse } from "@/modules/api/v2/management/responses/lib/response";
import { ZResponseInput as ZV2ManagementResponseInput } from "@/modules/api/v2/management/responses/types/responses";

/**
 * ENG-3722, against the real pool. The v1 and v2 management response creates used to read the
 * workspace's organization (v2: and its billing row) and the respondent's contact through the root
 * client inside their transaction — each read checking out a SECOND pool connection while the
 * transaction held the first. On a saturated pod that read queues behind the very transaction waiting
 * for it.
 *
 * A one-connection pool is that saturation made deterministic: the transaction holds the only
 * connection, so a read that needs another one can only time out. Those reads, and the quota
 * definitions, now happen before the transaction opens, so each create links the contact, screens the
 * quota and commits.
 */
vi.hoisted(() => {
  // setupFiles has already pointed DATABASE_URL at the test database; narrow this file's pool to one
  // connection before the prisma client is constructed. Modules are isolated per test file, so no
  // other file sees this.
  const url = new URL(process.env.DATABASE_URL ?? "");
  url.searchParams.set("connection_limit", "1");
  url.searchParams.set("connect_timeout", "2");
  process.env.DATABASE_URL = url.toString();
});

beforeEach(async () => {
  await resetDb();
});

afterEach(() => {
  vi.restoreAllMocks();
});

const USER_ID = "eng-3722-user";

const seed = async () => {
  const organization = await prisma.organization.create({
    data: {
      name: "ENG-3722 org",
      // The v2 create refuses an organization without a billing row.
      billing: { create: { limits: { projects: null, monthly: { responses: null, miu: null } } } },
    },
  });
  const workspace = await prisma.workspace.create({
    data: { name: "ENG-3722 workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: "ENG-3722 survey", workspaceId: workspace.id, status: "inProgress" },
  });
  // Empty logic matches every response, so the only way this quota goes unscreened is if evaluation
  // never runs. Counting partial submissions lets an unfinished create be screened.
  const quota = await prisma.surveyQuota.create({
    data: {
      surveyId: survey.id,
      name: "Everyone",
      limit: 100,
      logic: { connector: "and", conditions: [] },
      action: "continueSurvey",
      countPartialSubmissions: true,
    },
  });
  // Both management APIs find the contact by its `userId` attribute.
  const userIdKey = await prisma.contactAttributeKey.create({
    data: { workspaceId: workspace.id, key: "userId", isUnique: true, type: "default" },
  });
  const contact = await prisma.contact.create({
    data: {
      workspaceId: workspace.id,
      attributes: { create: { attributeKeyId: userIdKey.id, value: USER_ID } },
    },
  });
  return { workspaceId: workspace.id, surveyId: survey.id, quotaId: quota.id, contactId: contact.id };
};

const expectLinkedAndScreened = async (responseId: string, contactId: string, quotaId: string) => {
  await expect(
    prisma.response.findUnique({ where: { id: responseId }, select: { contactId: true } })
  ).resolves.toEqual({ contactId });
  await expect(
    prisma.responseQuotaLink.findUnique({ where: { responseId_quotaId: { responseId, quotaId } } })
  ).resolves.toMatchObject({ status: "screenedIn" });
};

describe("management response creates on a saturated pool (ENG-3722)", () => {
  test("v1 reads the organization, contact and quotas without a second connection", async () => {
    const { workspaceId, surveyId, quotaId, contactId } = await seed();
    const loggedError = vi.spyOn(logger, "error");

    const created = await createV1ManagementResponse({
      workspaceId,
      surveyId,
      userId: USER_ID,
      finished: false,
      data: {},
    });

    expect(created.contact?.id).toBe(contactId);
    expect(loggedError).not.toHaveBeenCalled();
    await expectLinkedAndScreened(created.id, contactId, quotaId);
  }, 30_000);

  test("v2 reads the organization, billing, contact and quotas without a second connection", async () => {
    const { workspaceId, surveyId, quotaId, contactId } = await seed();
    const loggedError = vi.spyOn(logger, "error");

    // Parsed with the route's own schema, so the fixture is the shape the route would hand over (this
    // directory is outside the typecheck).
    const result = await createV2ManagementResponse(
      workspaceId,
      ZV2ManagementResponseInput.parse({ surveyId, userId: USER_ID, finished: false, data: {} })
    );

    expect(result.ok).toBe(true);
    expect(loggedError).not.toHaveBeenCalled();
    if (result.ok) {
      await expectLinkedAndScreened(result.data.id, contactId, quotaId);
    }
  }, 30_000);
});
