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
-- Guarded on the catalog rather than run bare, so this is convergent: on a second run, and on a
-- database created with `db:push`, `ChartType` already lacks `line` and the whole block is a no-op.
-- Without the guard both cases fail — and they fail at the *backfill*, before the enum swap, because
-- `"type" = 'line'` cannot even be parsed once `line` is not a member of the enum
-- (`invalid input value for enum ChartType: "line"`), which reads as data corruption rather than as
-- "already applied".
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ChartType'
      AND e.enumlabel = 'line'
  ) THEN
    RETURN;
  END IF;

  -- Backfill: every line chart becomes an area chart displayed as a line.
  --
  -- The `jsonb_typeof` guard is not paranoia about NULL — `config` is `Json @default("{}")` and
  -- NOT NULL. It is about the shape *inside* the column, which Postgres does not constrain: for a
  -- non-object `jsonb`, `||` does not fail, it concatenates as an array. A row holding `'null'`,
  -- a scalar or an array would silently become `[null, {"areaDisplay": "line"}]` and stop parsing
  -- as ZChartConfig. Every row the app writes is an object, so this should match nothing; if one
  -- ever does, it gets a valid config carrying the display style instead of a corrupt one, since
  -- the value it replaces was already unusable.
  UPDATE "public"."Chart"
  SET "type"   = 'area',
      "config" = CASE
                   WHEN jsonb_typeof("config") = 'object'
                     THEN "config" || '{"areaDisplay": "line"}'::jsonb
                   ELSE '{"areaDisplay": "line"}'::jsonb
                 END
  WHERE "type" = 'line';

  CREATE TYPE "public"."ChartType_new" AS ENUM ('area', 'bar', 'pie', 'big_number');
  ALTER TABLE "public"."Chart" ALTER COLUMN "type" TYPE "public"."ChartType_new" USING ("type"::text::"public"."ChartType_new");
  ALTER TYPE "public"."ChartType" RENAME TO "ChartType_old";
  ALTER TYPE "public"."ChartType_new" RENAME TO "ChartType";
  DROP TYPE "public"."ChartType_old";
END $$;
COMMIT;
