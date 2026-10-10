import "server-only";
import { prisma } from "@formbricks/database";
import { Prisma } from "@formbricks/database/prisma";
import { type TKeysetCursor, keysetOrderBy, keysetPagePredicate } from "@/app/api/v3/lib/keyset-cursor";
import type { TSurveyActorContext } from "@/lib/survey/visibility/actor-context";
import { visibleSurveySqlPredicate } from "@/lib/survey/visibility/predicate";
import { escapeLikePattern } from "@/lib/utils/like-pattern";
import { getUniqueConstraintFields, isUniqueConstraintError } from "@/lib/utils/prisma-constraint";
import type { TRetentionExemptionPolicy } from "../types";

/** One exemption, with the survey and creator it names. */
export type TRetentionExemptionRow = {
  id: string;
  entity: TRetentionExemptionPolicy;
  until: Date;
  reason: string;
  createdAt: Date;
  revokedAt: Date | null;
  surveyId: string;
  surveyName: string;
  workspaceId: string;
  createdById: string | null;
  createdByName: string | null;
  /** The survey's visibility projection state, for the ENG-3282 graph check. Never serialized. */
  visibilityVersion: number;
  visibilityProjectedVersion: number;
};

/**
 * Which exemptions a reader may see. Owners and managers see every survey in the organisation. Anyone
 * else sees an exemption only when they could read its survey: in a workspace they have access to, and
 * not restricted from them (ENG-3282). Exemptions name their survey and say why it is kept, so listing
 * one for a survey the reader can't open would leak it.
 */
export type TRetentionExemptionReadScope =
  | Readonly<{ kind: "organization" }>
  | Readonly<{ kind: "surveys"; workspaceIds: ReadonlyArray<string>; actorContext: TSurveyActorContext }>;

// Identifiers can't be bound parameters, so they're built from literals, inside functions: a
// module-scope `Prisma.raw` breaks under the Prisma test mock.
const exemptionSortColumn = () => Prisma.raw(`e."created_at"`);
const exemptionIdColumn = () => Prisma.raw(`e."id"`);

/** The read scope as SQL over `Survey s`, or `null` when it admits nothing. */
const readScopeClause = (scope: TRetentionExemptionReadScope): Prisma.Sql | null => {
  if (scope.kind === "organization") return Prisma.sql`TRUE`;
  if (scope.workspaceIds.length === 0) return null;
  return Prisma.sql`s."workspaceId" IN (${Prisma.join(scope.workspaceIds)}) AND ${visibleSurveySqlPredicate(scope.actorContext, "s")}`;
};

const selectExemptionRows = (where: Prisma.Sql[], tail: Prisma.Sql) => prisma.$queryRaw<
  TRetentionExemptionRow[]
>`
  SELECT e."id", e."entity", e."until", e."reason", e."created_at" AS "createdAt", e."revokedAt",
         s."id" AS "surveyId", s."name" AS "surveyName", s."workspaceId",
         u."id" AS "createdById", u."name" AS "createdByName",
         s."visibilityVersion", s."visibilityProjectedVersion"
  FROM "RetentionExemption" e
  JOIN "Survey" s ON s."id" = e."surveyId"
  LEFT JOIN "User" u ON u."id" = e."createdById"
  WHERE ${Prisma.join(where, " AND ")}
  ${tail}
`;

/**
 * A page of the active exemptions (not revoked, not yet ended), newest first, keyset-paged on
 * `(createdAt, id)` over `RetentionExemption(organizationId, createdAt, id)`. Fetches `limit + 1` rows so
 * the caller can tell a last page from a full one (`buildKeysetPage`).
 */
export async function listRetentionExemptionKeysetPage({
  organizationId,
  scope,
  now,
  limit,
  cursor,
}: {
  organizationId: string;
  scope: TRetentionExemptionReadScope;
  now: Date;
  limit: number;
  cursor: Pick<TKeysetCursor, "value" | "id"> | null;
}): Promise<TRetentionExemptionRow[]> {
  const scopeClause = readScopeClause(scope);
  if (!scopeClause) return [];

  const where = [
    Prisma.sql`e."organizationId" = ${organizationId}`,
    Prisma.sql`e."revokedAt" IS NULL`,
    Prisma.sql`e."until" > ${now}`,
    scopeClause,
  ];
  if (cursor) {
    where.push(
      keysetPagePredicate({
        sortColumn: exemptionSortColumn(),
        idColumn: exemptionIdColumn(),
        direction: "desc",
        cursor,
      })
    );
  }

  return selectExemptionRows(
    where,
    Prisma.sql`${keysetOrderBy({ sortColumn: exemptionSortColumn(), idColumn: exemptionIdColumn(), direction: "desc" })} LIMIT ${limit + 1}`
  );
}

/** One exemption of the organisation, active or not, if the scope lets the reader see it. */
export async function findRetentionExemption({
  id,
  organizationId,
  scope,
}: {
  id: string;
  organizationId: string;
  scope: TRetentionExemptionReadScope;
}): Promise<TRetentionExemptionRow | null> {
  const scopeClause = readScopeClause(scope);
  if (!scopeClause) return null;

  const [row] = await selectExemptionRows(
    [Prisma.sql`e."id" = ${id}`, Prisma.sql`e."organizationId" = ${organizationId}`, scopeClause],
    Prisma.sql`LIMIT 1`
  );
  return row ?? null;
}

/**
 * A survey's active exemptions, newest first. The caller has already authorized reading the survey; the
 * organisation is matched too, as a second fence.
 */
export const listActiveSurveyRetentionExemptions = ({
  surveyId,
  organizationId,
  now,
}: {
  surveyId: string;
  organizationId: string;
  now: Date;
}) =>
  selectExemptionRows(
    [
      Prisma.sql`e."surveyId" = ${surveyId}`,
      Prisma.sql`e."organizationId" = ${organizationId}`,
      Prisma.sql`e."revokedAt" IS NULL`,
      Prisma.sql`e."until" > ${now}`,
    ],
    Prisma.sql`ORDER BY e."created_at" DESC, e."id" DESC`
  );

/** The organisation an exemption belongs to, the only thing a route may read before authorizing. */
export async function getRetentionExemptionOrganizationId(id: string): Promise<string | null> {
  const exemption = await prisma.retentionExemption.findUnique({
    where: { id },
    select: { organizationId: true },
  });
  return exemption?.organizationId ?? null;
}

/** The survey an exemption is being created for, with the organisation that owns it. */
export async function getRetentionExemptionSurvey(
  surveyId: string
): Promise<{ id: string; name: string; organizationId: string } | null> {
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
    select: { id: true, name: true, workspace: { select: { organizationId: true } } },
  });
  return survey
    ? { id: survey.id, name: survey.name, organizationId: survey.workspace.organizationId }
    : null;
}

/** A survey already holds an active exemption for the policy. */
export class RetentionExemptionExistsError extends Error {
  constructor() {
    super("This survey already has an active exemption for this policy.");
    this.name = "RetentionExemptionExistsError";
  }
}

const ACTIVE_EXEMPTION_FIELDS = ["surveyId", "entity"];

/**
 * Create an exemption. The partial unique index holds one unrevoked exemption per survey and policy, but
 * "active" also means not yet ended, which no index predicate can test. So an ended, unrevoked row is
 * closed first, its `revokedAt` set to the moment it ended (with no `revokedById`: nobody revoked it),
 * in the same transaction as the insert. An exemption that is still running makes the insert violate
 * the index, which is reported as `RetentionExemptionExistsError`, also when two requests race.
 */
export async function createRetentionExemption({
  organizationId,
  surveyId,
  entity,
  until,
  reason,
  createdById,
  now,
}: {
  organizationId: string;
  surveyId: string;
  entity: TRetentionExemptionPolicy;
  until: Date;
  reason: string;
  createdById: string;
  now: Date;
}): Promise<{ id: string }> {
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        UPDATE "RetentionExemption"
        SET "revokedAt" = "until"
        WHERE "surveyId" = ${surveyId} AND "entity" = ${entity}::"RetentionEntity"
          AND "revokedAt" IS NULL AND "until" <= ${now}
      `;
      return tx.retentionExemption.create({
        data: { organizationId, surveyId, entity, until, reason, createdById },
        select: { id: true },
      });
    });
  } catch (error) {
    if (
      isUniqueConstraintError(error) &&
      ACTIVE_EXEMPTION_FIELDS.every((field) => getUniqueConstraintFields(error).includes(field))
    ) {
      throw new RetentionExemptionExistsError();
    }
    throw error;
  }
}

/**
 * End an active exemption now, keeping the row for history. Conditional on the exemption still being
 * active, so two revokes, or a revoke racing its end date, change it at most once. Returns whether it
 * did.
 */
export async function revokeRetentionExemption({
  id,
  revokedById,
  now,
}: {
  id: string;
  revokedById: string;
  now: Date;
}): Promise<boolean> {
  const { count } = await prisma.retentionExemption.updateMany({
    where: { id, revokedAt: null, until: { gt: now } },
    data: { revokedAt: now, revokedById },
  });
  return count === 1;
}

/** A survey the Add exemption picker can offer. */
export type TRetentionExemptionSurveyOptionRow = {
  id: string;
  name: string;
  workspaceName: string;
};

/**
 * Surveys of the organisation whose name contains `search` (case-insensitive), most recently updated
 * first, for the Add exemption picker. The search is literal: `%` and `_` match themselves. Every status counts: a survey about to be archived or deleted is
 * the one most likely to need an exemption. Only owners and managers call this, and they can read every
 * survey, so no visibility filter applies.
 */
export async function searchRetentionExemptionSurveys({
  organizationId,
  search,
  limit,
}: {
  organizationId: string;
  search: string;
  limit: number;
}): Promise<TRetentionExemptionSurveyOptionRow[]> {
  const surveys = await prisma.survey.findMany({
    where: {
      workspace: { organizationId },
      ...(search ? { name: { contains: escapeLikePattern(search), mode: "insensitive" } } : {}),
    },
    select: { id: true, name: true, workspace: { select: { name: true } } },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: limit,
  });
  return surveys.map((survey) => ({
    id: survey.id,
    name: survey.name,
    workspaceName: survey.workspace.name,
  }));
}
