import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { resetDb } from "@/integration/reset-db";
import { createResponseWithQuotaEvaluation } from "./response";

/**
 * ENG-3285, against the real pool. A client response create used to read the workspace's organization
 * and the respondent's contact through the root client inside its transaction — each read checking out a
 * SECOND pool connection while the transaction held the first. On a saturated pod that read queues
 * behind the very transaction waiting for it.
 *
 * A one-connection pool is that saturation made deterministic: the transaction holds the only
 * connection, so a read that needs another one can only time out. Those reads, and the quota
 * definitions, now happen before the transaction opens, so the create links the contact, screens the
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

const seed = async () => {
  const organization = await prisma.organization.create({ data: { name: "ENG-3285 org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "ENG-3285 workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: "ENG-3285 survey", workspaceId: workspace.id, status: "inProgress" },
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
  const contact = await prisma.contact.create({ data: { workspaceId: workspace.id } });
  return { workspaceId: workspace.id, surveyId: survey.id, quotaId: quota.id, contactId: contact.id };
};

describe("client createResponseWithQuotaEvaluation on a saturated pool (ENG-3285)", () => {
  test("reads the organization, contact and quotas without a second connection", async () => {
    const { workspaceId, surveyId, quotaId, contactId } = await seed();
    const loggedError = vi.spyOn(logger, "error");

    const created = await createResponseWithQuotaEvaluation({
      workspaceId,
      surveyId,
      contactId,
      displayId: null,
      finished: false,
      data: {},
      meta: {},
      ttc: {},
      singleUseId: null,
      variables: {},
    });

    expect(created.contact?.id).toBe(contactId);
    expect(loggedError).not.toHaveBeenCalled();
    await expect(
      prisma.response.findUnique({ where: { id: created.id }, select: { contactId: true } })
    ).resolves.toEqual({ contactId });
    await expect(
      prisma.responseQuotaLink.findUnique({
        where: { responseId_quotaId: { responseId: created.id, quotaId } },
      })
    ).resolves.toMatchObject({ status: "screenedIn" });
  }, 30_000);
});
