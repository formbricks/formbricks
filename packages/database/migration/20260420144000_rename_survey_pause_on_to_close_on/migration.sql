DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Survey'
      AND column_name = 'pauseOn'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Survey'
      AND column_name = 'closeOn'
  ) THEN
    ALTER TABLE "Survey" RENAME COLUMN "pauseOn" TO "closeOn";
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Survey'
      AND column_name = 'pauseOn'
  ) AND EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Survey'
      AND column_name = 'closeOn'
  ) THEN
    UPDATE "Survey"
    SET "closeOn" = COALESCE("closeOn", "pauseOn")
    WHERE "pauseOn" IS NOT NULL;

    ALTER TABLE "Survey" DROP COLUMN "pauseOn";
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'Survey_status_pauseOn_idx'
  ) AND NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'Survey_status_closeOn_idx'
  ) THEN
    ALTER INDEX "Survey_status_pauseOn_idx" RENAME TO "Survey_status_closeOn_idx";
  ELSIF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'Survey_status_pauseOn_idx'
  ) AND EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'Survey_status_closeOn_idx'
  ) THEN
    DROP INDEX "Survey_status_pauseOn_idx";
  END IF;
END $$;
