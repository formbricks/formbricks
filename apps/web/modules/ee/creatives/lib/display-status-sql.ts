import "server-only";
import { Prisma } from "@formbricks/database/prisma";

/**
 * The SQL twin of `getCreativeDisplayState` (display-status.ts), for list filters: the same derivation,
 * branch for branch and in the same order, as one `CASE` expression. `display-status-cases.ts` holds
 * both to one case table (the SQL side runs in `display-status-sql.integration.test.ts`).
 *
 * Takes column references rather than naming `"Creative"` itself, so the caller decides the aliases and
 * the join; the survey columns are `NULL` when the creative opens a link or nothing (a `LEFT JOIN`).
 * Build each reference with `Prisma.raw` from a literal, never from caller input. `now` is bound as a
 * parameter. Comparisons use untyped literals, so the expression works on the enum columns and on text.
 */
export type TCreativeDisplayStatusColumns = {
  status: Prisma.Sql;
  archivedAt: Prisma.Sql;
  startAt: Prisma.Sql;
  endAt: Prisma.Sql;
  surveyStatus: Prisma.Sql;
  surveyArchivedAt: Prisma.Sql;
  /** `getCreativeDeliveryGap`'s answer as text, `NULL` for none: `creativeDeliveryGapSql` builds it. */
  deliveryGap: Prisma.Sql;
};

export const creativeDisplayStatusSql = (columns: TCreativeDisplayStatusColumns, now: Date): Prisma.Sql => {
  const { status, archivedAt, startAt, endAt, surveyStatus, surveyArchivedAt, deliveryGap } = columns;

  return Prisma.sql`(CASE
    WHEN ${archivedAt} IS NOT NULL THEN 'archived'
    WHEN ${status} = 'draft' THEN 'draft'
    WHEN ${status} = 'completed' THEN 'closed'
    WHEN ${endAt} IS NOT NULL AND ${endAt} <= ${now} THEN 'closed'
    WHEN ${status} = 'paused' THEN 'paused'
    WHEN ${deliveryGap} IS NOT NULL THEN 'paused'
    WHEN ${startAt} IS NOT NULL AND ${startAt} > ${now} THEN 'scheduled'
    WHEN ${surveyStatus} IS NOT NULL AND (${surveyStatus} <> 'inProgress' OR ${surveyArchivedAt} IS NOT NULL)
      THEN 'paused'
    ELSE 'active'
  END)`;
};

/**
 * The SQL twin of `getCreativeDeliveryGap` over a `"Creative"` row: `'destinationMissing'` when it needs
 * a Destination (a feedback button, or a banner whose `content.button` is set) and has neither a survey
 * nor a link, `'actionMissing'` when it shows on an action and has no trigger, else `NULL`. `creative` is
 * the row's alias, from a literal.
 */
export const creativeDeliveryGapSql = (creative: string): Prisma.Sql => {
  const column = (name: string) => Prisma.raw(`${creative}."${name}"`);

  return Prisma.sql`(CASE
    WHEN (${column("type")} = 'feedbackButton' OR jsonb_typeof(${column("content")} -> 'button') = 'object')
      AND ${column("surveyId")} IS NULL AND ${column("linkUrl")} IS NULL
      THEN 'destinationMissing'
    WHEN ${column("showOn")} = 'action'
      AND NOT EXISTS (SELECT 1 FROM "CreativeTrigger" t WHERE t."creativeId" = ${column("id")})
      THEN 'actionMissing'
  END)`;
};
