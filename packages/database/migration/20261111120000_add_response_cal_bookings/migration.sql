-- AlterTable
-- What a Cal.com element reported when the respondent booked, `{ [Question ID]: booking }`, kept beside
-- the "booked" answer in `data` so the v1 and v2 APIs and webhook receivers keep seeing what they saw
-- before. Nullable with no default, so this is a metadata-only change with no table rewrite on the
-- largest table, and a previous release's pods, which neither select nor write it, keep working.
-- `IF NOT EXISTS` keeps a re-run, or a database created with `db:push`, a no-op.
SET lock_timeout = '1s';

ALTER TABLE "Response" ADD COLUMN IF NOT EXISTS "cal_bookings_by_question_id" JSONB;

RESET lock_timeout;
