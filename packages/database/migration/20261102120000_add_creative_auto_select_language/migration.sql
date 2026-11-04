-- ENG-6871: a creative's own "Use browser language by default" setting. Until now a creative's texts
-- followed the setting of the survey it opens, and a creative opening a link or nothing never followed
-- the browser's language.
--
-- `null` means never chosen, as on "Survey", and acts as `false`: the editor turns it on when a creative
-- starts offering a second language. A creative that already has another language starts with it on.
-- A nullable column without a default adds without rewriting the table, and "Creative" is new in this
-- release, so the backfill touches at most the few rows made since the upgrade.

SET lock_timeout = '1s';

-- AlterTable
ALTER TABLE "Creative" ADD COLUMN IF NOT EXISTS "autoSelectLanguage" BOOLEAN;

-- Backfill
UPDATE "Creative" SET "autoSelectLanguage" = true
WHERE "autoSelectLanguage" IS NULL
  AND EXISTS (
    SELECT 1 FROM "CreativeLanguage"
    WHERE "CreativeLanguage"."creativeId" = "Creative"."id" AND NOT "CreativeLanguage"."default"
  );
