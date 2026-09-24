import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { logger } from "@formbricks/logger";
import { ZId } from "@formbricks/types/common";
import { validateInputs } from "@/lib/utils/validate";
import { getIsWorkflowsEnabled } from "@/modules/ee/license-check/lib/utils";
import type { TOrganizationUsage, TOrganizationUsageWorkspace } from "../types/usage";
import { ACTIVE_MEMBER_DAYS, DORMANT_MEMBER_DAYS } from "./constants";
import type { TUsageRangeBounds } from "./range";

const DAY_MS = 24 * 60 * 60 * 1000;

const createdAtFragment = (column: Prisma.Sql, { from, to }: TUsageRangeBounds): Prisma.Sql =>
  Prisma.sql`${from ? Prisma.sql`AND ${column} >= ${from}` : Prisma.empty} ${
    to ? Prisma.sql`AND ${column} <= ${to}` : Prisma.empty
  }`;

// One grouped pass per workspace (ENG-3326). The LEFT JOINs keep workspaces with no responses as a 0 row,
// and the join walks the `[surveyId, created_at, id]` index, so cost follows the responses in the range.
const getResponseCountsByWorkspace = async (organizationId: string, range: TUsageRangeBounds) => {
  const rows = await prisma.$queryRaw<{ id: string; name: string; responseCount: bigint }[]>`
    SELECT w."id", w."name", COUNT(r."id") AS "responseCount"
    FROM "Workspace" w
    LEFT JOIN "Survey" s ON s."workspaceId" = w."id"
    LEFT JOIN "Response" r ON r."surveyId" = s."id" ${createdAtFragment(Prisma.sql`r."created_at"`, range)}
    WHERE w."organizationId" = ${organizationId}
    GROUP BY w."id", w."name"
    ORDER BY w."name" ASC`;

  return rows.map((row) => ({ id: row.id, name: row.name, responseCount: Number(row.responseCount) }));
};

// Dry runs are excluded, as the metered usage and the telemetry exclude them.
const getWorkflowRunCountsByWorkspace = async (organizationId: string, { from, to }: TUsageRangeBounds) => {
  const rows = await prisma.workflowRun.groupBy({
    by: ["workspaceId"],
    where: {
      workspace: { organizationId },
      isDryRun: false,
      ...(from || to ? { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } } : {}),
    },
    _count: { _all: true },
  });

  return new Map(rows.map((row) => [row.workspaceId, row._count._all]));
};

// Mirrors the survey list's labels: "scheduled" is a paused survey with a publish date, and an archived
// survey is counted as archived whatever its status was.
const getSurveyCounts = async (organizationId: string): Promise<TOrganizationUsage["surveys"]> => {
  const [row] = await prisma.$queryRaw<Record<keyof TOrganizationUsage["surveys"], bigint>[]>`
    SELECT
      COUNT(*) FILTER (WHERE s."archivedAt" IS NULL AND s."status" = 'draft') AS "draft",
      COUNT(*) FILTER (WHERE s."archivedAt" IS NULL AND s."status" = 'paused' AND s."publishOn" IS NOT NULL) AS "scheduled",
      COUNT(*) FILTER (WHERE s."archivedAt" IS NULL AND s."status" = 'inProgress') AS "inProgress",
      COUNT(*) FILTER (WHERE s."archivedAt" IS NULL AND s."status" = 'paused' AND s."publishOn" IS NULL) AS "paused",
      COUNT(*) FILTER (WHERE s."archivedAt" IS NULL AND s."status" = 'completed') AS "completed",
      COUNT(*) FILTER (WHERE s."archivedAt" IS NOT NULL) AS "archived"
    FROM "Survey" s
    JOIN "Workspace" w ON w."id" = s."workspaceId"
    WHERE w."organizationId" = ${organizationId}`;

  return {
    draft: Number(row?.draft ?? 0),
    scheduled: Number(row?.scheduled ?? 0),
    inProgress: Number(row?.inProgress ?? 0),
    paused: Number(row?.paused ?? 0),
    completed: Number(row?.completed ?? 0),
    archived: Number(row?.archived ?? 0),
  };
};

// Every membership row, like the Members list and the owner count — `accepted` gates nothing, so it is not
// filtered on. Deactivated is decided first, so a deactivated user is never also counted as active or
// dormant (ENG-3330).
const getMemberCounts = async (organizationId: string, now: Date): Promise<TOrganizationUsage["members"]> => {
  const activeSince = new Date(now.getTime() - ACTIVE_MEMBER_DAYS * DAY_MS);
  const dormantBefore = new Date(now.getTime() - DORMANT_MEMBER_DAYS * DAY_MS);

  const [row] = await prisma.$queryRaw<Record<keyof TOrganizationUsage["members"], bigint>[]>`
    SELECT
      COUNT(*) AS "total",
      COUNT(*) FILTER (WHERE u."isActive" AND u."lastLoginAt" >= ${activeSince}) AS "active",
      COUNT(*) FILTER (WHERE u."isActive" AND (u."lastLoginAt" IS NULL OR u."lastLoginAt" < ${dormantBefore})) AS "dormant",
      COUNT(*) FILTER (WHERE NOT u."isActive") AS "deactivated"
    FROM "Membership" m
    JOIN "User" u ON u."id" = m."userId"
    WHERE m."organizationId" = ${organizationId}`;

  return {
    total: Number(row?.total ?? 0),
    active: Number(row?.active ?? 0),
    dormant: Number(row?.dormant ?? 0),
    deactivated: Number(row?.deactivated ?? 0),
  };
};

export const getOrganizationUsage = async ({
  organizationId,
  range,
  timeZone,
  now = new Date(),
}: {
  organizationId: string;
  range: TUsageRangeBounds;
  timeZone: string;
  now?: Date;
}): Promise<TOrganizationUsage> => {
  validateInputs([organizationId, ZId]);
  const startedAt = performance.now();

  const isWorkflowsEnabled = await getIsWorkflowsEnabled(organizationId);
  const [responseCounts, workflowRunCounts, surveys, members] = await Promise.all([
    getResponseCountsByWorkspace(organizationId, range),
    isWorkflowsEnabled ? getWorkflowRunCountsByWorkspace(organizationId, range) : Promise.resolve(null),
    getSurveyCounts(organizationId),
    getMemberCounts(organizationId, now),
  ]);

  const workspaces: TOrganizationUsageWorkspace[] = responseCounts.map((workspace) => ({
    ...workspace,
    workflowRunCount: workflowRunCounts ? (workflowRunCounts.get(workspace.id) ?? 0) : null,
  }));

  // The timing the performance budget is checked against (ENG-3319): under 1 s up to a year, 3 s all-time.
  logger.info(
    {
      organizationId,
      durationMs: Math.round(performance.now() - startedAt),
      isAllTime: !range.from && !range.to,
    },
    "Organization usage computed"
  );

  return {
    workspaces,
    totals: {
      responseCount: workspaces.reduce((sum, workspace) => sum + workspace.responseCount, 0),
      workflowRunCount: workflowRunCounts
        ? workspaces.reduce((sum, workspace) => sum + (workspace.workflowRunCount ?? 0), 0)
        : null,
    },
    surveys,
    members,
    timeZone,
  };
};
