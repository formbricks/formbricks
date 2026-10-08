import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import {
  RetentionExemptionExistsError,
  type TRetentionExemptionReadScope,
  createRetentionExemption,
  findRetentionExemption,
  listRetentionExemptionKeysetPage,
  revokeRetentionExemption,
  searchRetentionExemptionSurveys,
} from "./exemptions-service";

const NOW = new Date("2030-06-01T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const later = (days: number) => new Date(NOW.getTime() + days * DAY);

const ORGANIZATION: TRetentionExemptionReadScope = { kind: "organization" };

describe("retention exemptions service (real Postgres)", () => {
  let organizationId: string;
  let userId: string;
  let workspaceId: string;
  let otherWorkspaceId: string;
  let surveyId: string;

  const memberScope = (workspaceIds: string[]): TRetentionExemptionReadScope => ({
    kind: "surveys",
    workspaceIds,
    actorContext: { enforced: true, isOrganizationAdmin: false, kind: "user", userId },
  });

  const create = (overrides: Partial<Parameters<typeof createRetentionExemption>[0]> = {}) =>
    createRetentionExemption({
      organizationId,
      surveyId,
      entity: "surveys",
      until: later(30),
      reason: "Audit",
      createdById: userId,
      now: NOW,
      ...overrides,
    });

  beforeEach(async () => {
    await resetDb();
    organizationId = (await prisma.organization.create({ data: { name: "Retention Org" } })).id;
    userId = (await prisma.user.create({ data: { name: "Anna Keller", email: "anna@example.com" } })).id;
    workspaceId = (await prisma.workspace.create({ data: { name: "Europe", organizationId } })).id;
    otherWorkspaceId = (await prisma.workspace.create({ data: { name: "Americas", organizationId } })).id;
    surveyId = (await prisma.survey.create({ data: { name: "Site visit feedback", workspaceId } })).id;
  });

  describe("createRetentionExemption", () => {
    test("closes an ended exemption at its end date before creating the new one", async () => {
      const ended = await prisma.retentionExemption.create({
        data: {
          organizationId,
          surveyId,
          entity: "surveys",
          until: later(-1),
          reason: "Old",
          createdById: userId,
        },
      });

      const { id } = await create();

      expect(await prisma.retentionExemption.findUniqueOrThrow({ where: { id: ended.id } })).toMatchObject({
        revokedAt: later(-1),
        revokedById: null,
      });
      expect(await prisma.retentionExemption.findUniqueOrThrow({ where: { id } })).toMatchObject({
        surveyId,
        entity: "surveys",
        until: later(30),
        reason: "Audit",
        createdById: userId,
        revokedAt: null,
      });
    });

    test("refuses a second active exemption for the same survey and policy, but not another policy", async () => {
      await create();

      await expect(create()).rejects.toBeInstanceOf(RetentionExemptionExistsError);
      await expect(create({ entity: "responses" })).resolves.toEqual({ id: expect.any(String) });
    });

    test("lets exactly one of two racing requests through", async () => {
      const results = await Promise.allSettled([create(), create()]);

      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const [rejected] = results.filter((result) => result.status === "rejected");
      expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(RetentionExemptionExistsError);
    });
  });

  describe("revokeRetentionExemption", () => {
    test("ends an active exemption once, and never one that already ended", async () => {
      const { id } = await create();
      const ended = await prisma.retentionExemption.create({
        data: { organizationId, surveyId, entity: "responses", until: later(-1), reason: "Old" },
      });

      await expect(revokeRetentionExemption({ id, revokedById: userId, now: NOW })).resolves.toBe(true);
      await expect(revokeRetentionExemption({ id, revokedById: userId, now: NOW })).resolves.toBe(false);
      await expect(revokeRetentionExemption({ id: ended.id, revokedById: userId, now: NOW })).resolves.toBe(
        false
      );
      expect(await prisma.retentionExemption.findUniqueOrThrow({ where: { id } })).toMatchObject({
        revokedAt: NOW,
        revokedById: userId,
      });
    });
  });

  describe("listRetentionExemptionKeysetPage", () => {
    const walk = async (scope: TRetentionExemptionReadScope, limit: number) => {
      const seen: string[] = [];
      let cursor: { value: string; id: string } | null = null;
      for (let pages = 0; pages < 100; pages++) {
        const rows = await listRetentionExemptionKeysetPage({
          organizationId,
          scope,
          now: NOW,
          limit,
          cursor,
        });
        const page = rows.slice(0, limit);
        seen.push(...page.map((row) => row.id));
        if (rows.length <= limit) return seen;
        const last = page.at(-1)!;
        cursor = { value: last.createdAt.toISOString(), id: last.id };
      }
      throw new Error("walk did not end");
    };

    test.each([1, 2, 5])(
      "walks the active exemptions %i at a time, newest first, across tied creation times",
      async (limit) => {
        const surveys = await Promise.all(
          [0, 1, 2, 3, 4, 5].map((index) =>
            prisma.survey.create({ data: { name: `Survey ${index}`, workspaceId } })
          )
        );
        // Two creation times, three exemptions each, with ids that sort against creation time.
        const rows = surveys.map((survey, index) => ({
          id: `clexm${String(9 - index).padStart(20, "0")}`,
          organizationId,
          surveyId: survey.id,
          entity: "surveys" as const,
          until: later(30),
          reason: "Audit",
          createdAt: index < 3 ? later(-2) : later(-1),
        }));
        await prisma.retentionExemption.createMany({ data: rows });
        // Neither a revoked nor an ended exemption is listed.
        await prisma.retentionExemption.createMany({
          data: [
            {
              organizationId,
              surveyId,
              entity: "surveys",
              until: later(30),
              reason: "x",
              revokedAt: later(-1),
            },
            { organizationId, surveyId, entity: "responses", until: NOW, reason: "x" },
          ],
        });

        const expected = [...rows]
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : -1))
          .map((row) => row.id);
        expect(await walk(ORGANIZATION, limit)).toEqual(expected);
      }
    );

    test("names the survey, its workspace and the creator", async () => {
      const { id } = await create();

      const [row] = await listRetentionExemptionKeysetPage({
        organizationId,
        scope: ORGANIZATION,
        now: NOW,
        limit: 10,
        cursor: null,
      });

      expect(row).toMatchObject({
        id,
        entity: "surveys",
        surveyId,
        surveyName: "Site visit feedback",
        workspaceId,
        createdById: userId,
        createdByName: "Anna Keller",
      });
    });

    test("shows a member only the exemptions of surveys they could open", async () => {
      const otherOwner = (await prisma.user.create({ data: { name: "Tom", email: "tom@example.com" } })).id;
      const elsewhere = await prisma.survey.create({
        data: { name: "Elsewhere", workspaceId: otherWorkspaceId },
      });
      const restricted = await prisma.survey.create({
        data: { name: "Restricted", workspaceId, visibility: "restricted", ownerId: otherOwner },
      });
      const ownRestricted = await prisma.survey.create({
        data: { name: "Mine", workspaceId, visibility: "restricted", ownerId: userId },
      });
      const visible = await create();
      await create({ surveyId: elsewhere.id });
      await create({ surveyId: restricted.id });
      const own = await create({ surveyId: ownRestricted.id });

      const ids = await walk(memberScope([workspaceId]), 10);

      expect(ids.sort()).toEqual([visible.id, own.id].sort());
      expect(await walk(memberScope([]), 10)).toEqual([]);
      expect(await walk(ORGANIZATION, 10)).toHaveLength(4);
    });

    test("keeps other organisations out", async () => {
      const otherOrganizationId = (await prisma.organization.create({ data: { name: "Other" } })).id;
      const otherWorkspace = await prisma.workspace.create({
        data: { name: "Theirs", organizationId: otherOrganizationId },
      });
      const theirSurvey = await prisma.survey.create({
        data: { name: "Theirs", workspaceId: otherWorkspace.id },
      });
      await create({ organizationId: otherOrganizationId, surveyId: theirSurvey.id });

      expect(await walk(ORGANIZATION, 10)).toEqual([]);
    });
  });

  describe("findRetentionExemption", () => {
    test("finds a revoked exemption too, within the reader's scope and organisation only", async () => {
      const { id } = await create({ surveyId });
      await revokeRetentionExemption({ id, revokedById: userId, now: NOW });

      expect(await findRetentionExemption({ id, organizationId, scope: ORGANIZATION })).toMatchObject({
        id,
        revokedAt: NOW,
      });
      expect(
        await findRetentionExemption({ id, organizationId, scope: memberScope([otherWorkspaceId]) })
      ).toBeNull();
      expect(
        await findRetentionExemption({ id, organizationId: "clorgxxxxxxxxxxxxxxxxxxxx", scope: ORGANIZATION })
      ).toBeNull();
    });
  });

  describe("searchRetentionExemptionSurveys", () => {
    test("matches names case-insensitively across workspaces, newest change first, wildcards literal", async () => {
      await prisma.survey.create({ data: { name: "NPS 100% done", workspaceId: otherWorkspaceId } });
      await prisma.survey.create({ data: { name: "npS_q3", workspaceId } });
      const otherOrganizationId = (await prisma.organization.create({ data: { name: "Other" } })).id;
      const otherWorkspace = await prisma.workspace.create({
        data: { name: "Theirs", organizationId: otherOrganizationId },
      });
      await prisma.survey.create({ data: { name: "NPS elsewhere", workspaceId: otherWorkspace.id } });

      const nps = await searchRetentionExemptionSurveys({ organizationId, search: "nps", limit: 10 });
      expect(nps.map((survey) => survey.name)).toEqual(["npS_q3", "NPS 100% done"]);
      expect(nps[1].workspaceName).toBe("Americas");

      expect(
        (await searchRetentionExemptionSurveys({ organizationId, search: "%", limit: 10 })).map((s) => s.name)
      ).toEqual(["NPS 100% done"]);
      expect(
        (await searchRetentionExemptionSurveys({ organizationId, search: "S_", limit: 10 })).map(
          (s) => s.name
        )
      ).toEqual(["npS_q3"]);
      expect(await searchRetentionExemptionSurveys({ organizationId, search: "", limit: 2 })).toHaveLength(2);
    });
  });
});
