/*
  Warnings:

  - The values [line] on the enum `ChartType` will be removed.

  Line and Area rendered the same Recharts area series and differed only in how the band under
  the stroke was painted, so they collapse into one `area` type carrying a `config.areaDisplay`
  style. Existing `line` charts are backfilled to `area` + `areaDisplay: "line"` first, which is
  what lets the enum value be dropped below without data loss.

  `area` charts keep an absent `areaDisplay`: the app defaults it to "filled", so their rendering
  is unchanged and no row without a `line` type needs touching.
*/
-- AlterEnum. The backfill shares the transaction with the swap so a failure in either leaves the
-- column and the enum consistent, rather than rows already rewritten against the old type.
BEGIN;
-- Backfill: every line chart becomes an area chart displayed as a line.
UPDATE "public"."Chart"
SET "type"   = 'area',
    "config" = "config" || '{"areaDisplay": "line"}'::jsonb
WHERE "type" = 'line';
CREATE TYPE "public"."ChartType_new" AS ENUM ('area', 'bar', 'pie', 'big_number');
ALTER TABLE "public"."Chart" ALTER COLUMN "type" TYPE "public"."ChartType_new" USING ("type"::text::"public"."ChartType_new");
ALTER TYPE "public"."ChartType" RENAME TO "ChartType_old";
ALTER TYPE "public"."ChartType_new" RENAME TO "ChartType";
DROP TYPE "public"."ChartType_old";
COMMIT;
