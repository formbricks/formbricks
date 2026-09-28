-- AlterEnum. Additive: existing charts keep their type, and `IF NOT EXISTS` keeps a re-run (or a
-- database created with `db:push`) a no-op instead of an error.
ALTER TYPE "ChartType" ADD VALUE IF NOT EXISTS 'matrix';
