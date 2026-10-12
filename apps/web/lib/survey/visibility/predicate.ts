import { Prisma } from "@formbricks/database/prisma";
import type { TSurveyVisibility } from "@formbricks/types/surveys/types";
import type { TSurveyActorContext } from "./actor-context";

/** `isInitialProjection` (see `policy.ts`) as a `Survey` clause. */
const initialProjectionWhere: Prisma.SurveyWhereInput = {
  visibilityVersion: 0,
  visibilityProjectedVersion: { lt: 0 },
};

/**
 * `getEffectiveVisibility` as SQL (see `policy.ts`): workspace-visible when stored `workspace` with
 * nothing pending, or in its initial projection; restricted otherwise.
 */
export const effectivelyWorkspaceVisibleWhere: Prisma.SurveyWhereInput = {
  visibility: "workspace",
  OR: [{ visibilityPending: false }, initialProjectionWhere],
};

export const effectivelyRestrictedWhere: Prisma.SurveyWhereInput = {
  OR: [{ visibility: "restricted" }, { visibilityPending: true, NOT: initialProjectionWhere }],
};

/**
 * The one visibility predicate (ENG-3282, contract §6). Every list, count, export and response read
 * that can return a survey or its responses applies it in SQL — never as a post-filter, so `limit`,
 * cursors and counts stay exact and a restricted survey is not countable by someone who cannot see it.
 *
 * - enforcement off (readiness marker unset): no restriction, as before ENG-3282;
 * - organization owner/manager: no restriction;
 * - other user: effectively workspace-visible surveys, plus the ones they own;
 * - API key: effectively workspace-visible surveys. Never a restricted one.
 *
 * "Effectively workspace-visible" is `getEffectiveVisibility`: stored `workspace` with nothing pending,
 * or in its initial projection (a survey just created or copied, see `isInitialProjection`).
 *
 * Workspace membership is NOT part of this: callers already scope to a workspace the actor may read.
 */
export const buildVisibleSurveyWhere = (ctx: TSurveyActorContext): Prisma.SurveyWhereInput => {
  if (!ctx.enforced) return {};

  const sharedAndSettled = effectivelyWorkspaceVisibleWhere;
  if (ctx.kind === "apiKey") return sharedAndSettled;
  if (ctx.isOrganizationAdmin) return {};

  return { OR: [sharedAndSettled, { ownerId: ctx.userId }] };
};

/**
 * The surveys `buildVisibleSurveyWhere` leaves out, as a positive clause — for a table with no `Survey`
 * relation (workflow runs carry a bare `surveyId`) that has to name the surveys to exclude. `null` when
 * nothing is hidden. Spelled out rather than as `NOT visible`: `NOT (… OR "ownerId" = $user)` is null,
 * not true, for a survey with no owner, so the negation would silently keep an ownerless restricted one.
 */
export const buildHiddenSurveyWhere = (ctx: TSurveyActorContext): Prisma.SurveyWhereInput | null => {
  if (!ctx.enforced) return null;
  if (ctx.kind === "apiKey") return effectivelyRestrictedWhere;
  if (ctx.isOrganizationAdmin) return null;

  return {
    AND: [effectivelyRestrictedWhere, { OR: [{ ownerId: null }, { ownerId: { not: ctx.userId } }] }],
  };
};

/**
 * The same rule for a query spanning several organizations (the account-level notification settings),
 * where "organization administrator" differs per row: an owner or manager membership in the survey's
 * organization is the same test `organization.manage` makes.
 */
export const buildVisibleSurveyWhereAcrossOrganizations = (
  enforced: boolean,
  userId: string
): Prisma.SurveyWhereInput => {
  if (!enforced) return {};
  return {
    OR: [
      effectivelyWorkspaceVisibleWhere,
      { ownerId: userId },
      {
        workspace: {
          organization: { memberships: { some: { userId, role: { in: ["owner", "manager"] } } } },
        },
      },
    ],
  };
};

/**
 * Merge a visibility clause into a `Survey` where next to the caller's tenant scope. Nested under `AND`
 * so it can never replace a key of that scope (`workspaceId`, say), and omitted when empty so a query
 * with enforcement off is exactly the one it was before ENG-3282.
 */
export const andVisibleSurveys = (visibleSurveyWhere: Prisma.SurveyWhereInput): Prisma.SurveyWhereInput =>
  Object.keys(visibleSurveyWhere).length === 0 ? {} : { AND: [visibleSurveyWhere] };

export const buildVisibleResponseWhere = (ctx: TSurveyActorContext): Prisma.ResponseWhereInput => {
  const survey = buildVisibleSurveyWhere(ctx);
  return Object.keys(survey).length === 0 ? {} : { survey };
};

/**
 * The same predicate as a raw SQL fragment over a `"Survey"` row aliased `alias`, for the hand-written
 * response list and count queries. `alias` is an identifier chosen by the caller, never user input.
 */
export const visibleSurveySqlPredicate = (ctx: TSurveyActorContext, alias: string): Prisma.Sql => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(alias)) throw new Error("Invalid SQL alias");
  if (!ctx.enforced || (ctx.kind === "user" && ctx.isOrganizationAdmin)) return Prisma.sql`TRUE`;

  const table = Prisma.raw(`"${alias}"`);
  const sharedAndSettled = Prisma.sql`(${table}."visibility" = 'workspace' AND (${table}."visibilityPending" = false OR (${table}."visibilityVersion" = 0 AND ${table}."visibilityProjectedVersion" < 0)))`;
  if (ctx.kind === "apiKey") return sharedAndSettled;

  return Prisma.sql`(${sharedAndSettled} OR ${table}."ownerId" = ${ctx.userId})`;
};

/** The list's own `filter[visibility][in]` / `filter[owner][in]` (contract §6). */
export type TSurveyVisibilityFilter = Readonly<{
  owner?: ReadonlyArray<"me" | "others">;
  visibility?: ReadonlyArray<TSurveyVisibility>;
}>;

/**
 * Matches on the *reported* visibility, the one a caller sees on each item: pending counts as restricted
 * once a projection has been acknowledged, and with enforcement off every survey is workspace-visible.
 */
const effectiveVisibilityWhere = (
  visibility: TSurveyVisibility,
  enforced: boolean
): Prisma.SurveyWhereInput => {
  if (!enforced) return visibility === "workspace" ? {} : { id: { in: [] } };
  return visibility === "workspace" ? effectivelyWorkspaceVisibleWhere : effectivelyRestrictedWhere;
};

/**
 * Every clause a survey list or count query must AND together: the visibility predicate, then the
 * caller's own visibility and owner filters. A filter naming both values of a two-valued set is no
 * filter. `owner` is only meaningful for a user; callers refuse it for API keys (400) before this.
 */
export const buildSurveyAccessWhere = (
  ctx: TSurveyActorContext,
  filter: TSurveyVisibilityFilter = {}
): Prisma.SurveyWhereInput[] => {
  const clauses: Prisma.SurveyWhereInput[] = [];

  const visible = buildVisibleSurveyWhere(ctx);
  if (Object.keys(visible).length > 0) clauses.push(visible);

  if (filter.visibility?.length === 1) {
    const clause = effectiveVisibilityWhere(filter.visibility[0], ctx.enforced);
    if (Object.keys(clause).length > 0) clauses.push(clause);
  }

  if (filter.owner?.length === 1 && ctx.kind === "user") {
    clauses.push(
      filter.owner[0] === "me"
        ? { ownerId: ctx.userId }
        : { OR: [{ ownerId: { not: ctx.userId } }, { ownerId: null }] }
    );
  }

  return clauses;
};
