-- Creative counts (ENG-4000, ADR 0005): daily Impressions and Clicks per creative, split by device type
-- ("CreativeDailyStat") and by page ("CreativeDailyPageStat"). Additive only: one new enum and two new,
-- empty tables. No existing column changes and no data moves. Only the counter flush job writes them.
--
-- One transaction for the whole file, which is also what makes it rerunnable: a rollback leaves nothing
-- behind to collide with on the retry. Every type, table and constraint is created guarded, and the
-- foreign keys are added apart from their tables, so the file also converges on a database built with
-- `db:push`.
--
-- `lock_timeout` is SET LOCAL so it expires with the transaction instead of leaking into the migrations
-- that run after this one on the same connection. The foreign keys lock "Creative", a live table; failing
-- fast is better than queueing behind a long-running query and holding the lock queue open behind us.
--
-- The tables need no index beyond their primary keys: every read and the flush's upsert are by creative
-- and day, which is the keys' prefix.
BEGIN;
SET LOCAL lock_timeout = '5s';

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "CreativeDeviceType" AS ENUM ('phone', 'tablet', 'desktop');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "CreativeDailyStat" (
    "creativeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "deviceType" "CreativeDeviceType" NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CreativeDailyStat_pkey" PRIMARY KEY ("creativeId","date","deviceType")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "CreativeDailyPageStat" (
    "creativeId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "page" TEXT NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CreativeDailyPageStat_pkey" PRIMARY KEY ("creativeId","date","page")
);

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "CreativeDailyStat" ADD CONSTRAINT "CreativeDailyStat_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
-- squawk-ignore constraint-missing-not-valid, adding-foreign-key-constraint
DO $$
BEGIN
  ALTER TABLE "CreativeDailyPageStat" ADD CONSTRAINT "CreativeDailyPageStat_creativeId_fkey" FOREIGN KEY ("creativeId") REFERENCES "Creative"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMIT;
