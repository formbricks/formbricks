import { Prisma } from "@formbricks/database/prisma";
import type { TSurveyActorContext } from "./actor-context";

/**
 * The one visibility predicate (ENG-3282, contract §6). Every list, count, export and response read
 * that can return a survey or its responses applies it in SQL — never as a post-filter, so `limit`,
 * cursors and counts stay exact and a private survey is not countable by someone who cannot see it.
 *
 * - enforcement off (readiness marker unset): no restriction, as before ENG-3282;
 * - organization owner/manager: no restriction;
 * - other user: workspace-visible surveys with nothing pending, plus the ones they own;
 * - API key: workspace-visible surveys with nothing pending. Never a private one.
 *
 * Workspace membership is NOT part of this: callers already scope to a workspace the actor may read.
 */
export const buildVisibleSurveyWhere = (ctx: TSurveyActorContext): Prisma.SurveyWhereInput => {
  if (!ctx.enforced) return {};

  const sharedAndSettled: Prisma.SurveyWhereInput = { visibility: "workspace", visibilityPending: false };
  if (ctx.kind === "apiKey") return sharedAndSettled;
  if (ctx.isOrganizationAdmin) return {};

  return { OR: [sharedAndSettled, { ownerId: ctx.userId }] };
};

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
  const sharedAndSettled = Prisma.sql`(${table}."visibility" = 'workspace' AND ${table}."visibilityPending" = false)`;
  if (ctx.kind === "apiKey") return sharedAndSettled;

  return Prisma.sql`(${sharedAndSettled} OR ${table}."ownerId" = ${ctx.userId})`;
};
