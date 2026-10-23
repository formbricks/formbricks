import { beforeEach, describe, expect, test, vi } from "vitest";
import { prisma } from "@formbricks/database";
import { logger } from "@formbricks/logger";
import { resetDb } from "@/integration/reset-db";
import { updateResponseWithQuotaEvaluation } from "./response";

/**
 * ENG-3285, against the real pool. A response update evaluates quotas inside its transaction, and the
 * quota and survey definitions used to be read there through the root client — each read checking out
 * a SECOND pool connection while the transaction held the first. On a saturated pod that read queues
 * behind the very transaction waiting for it.
 *
 * A one-connection pool is that saturation made deterministic: the transaction holds the only
 * connection, so a read that needs another one can only time out. The definitions are now loaded
 * before the transaction opens, so the update evaluates its quota and writes the link.
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

const seedSurveyWithQuota = async () => {
  const organization = await prisma.organization.create({ data: { name: "ENG-3285 org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "ENG-3285 workspace", organizationId: organization.id },
  });
  const survey = await prisma.survey.create({
    data: { name: "ENG-3285 survey", workspaceId: workspace.id, status: "inProgress" },
  });
  // Empty logic matches every response, so the only way this quota goes unscreened is if evaluation
  // never runs.
  const quota = await prisma.surveyQuota.create({
    data: {
      surveyId: survey.id,
      name: "Everyone",
      limit: 100,
      logic: { connector: "and", conditions: [] },
      action: "continueSurvey",
    },
  });
  const response = await prisma.response.create({
    data: { surveyId: survey.id, data: {}, finished: false },
  });
  return { surveyId: survey.id, quotaId: quota.id, responseId: response.id };
};

describe("updateResponseWithQuotaEvaluation on a saturated pool (ENG-3285)", () => {
  test("evaluates quotas without a second connection, so the quota link is written", async () => {
    const { surveyId, quotaId, responseId } = await seedSurveyWithQuota();
    const loggedError = vi.spyOn(logger, "error");

    const updated = await updateResponseWithQuotaEvaluation(responseId, surveyId, {
      finished: true,
      data: {},
    });

    expect(updated.finished).toBe(true);
    expect(loggedError).not.toHaveBeenCalled();
    await expect(
      prisma.responseQuotaLink.findUnique({ where: { responseId_quotaId: { responseId, quotaId } } })
    ).resolves.toMatchObject({ status: "screenedIn" });
  }, 30_000);
});
