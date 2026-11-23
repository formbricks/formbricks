-- ENG-7313: persist "the instance has been set up", so a fresh-instance sign-up cannot re-arm.
--
-- "Fresh" was `SELECT count(*) FROM "User" = 0`, which flips back to true when the last user deletes
-- their account and re-opens the unauthenticated administrator sign-up. The singleton row below is
-- written once and never removed.
--
-- Existing instances are marked completed here when they already hold a user or an organization, so an
-- upgrade changes nothing for them. A database with neither is a genuinely fresh install and stays
-- fresh until its first sign-up (the app writes the row then). Additive: previous-release pods never
-- read this table, so a rolling upgrade is safe.
--
-- `IF NOT EXISTS` / `ON CONFLICT` keep the file rerunnable on a database built with `db:push`.

CREATE TABLE IF NOT EXISTS "InstanceSetup" (
    "id" TEXT NOT NULL DEFAULT 'instance',
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InstanceSetup_pkey" PRIMARY KEY ("id")
);

INSERT INTO "InstanceSetup" ("id")
SELECT 'instance'
WHERE EXISTS (SELECT 1 FROM "User") OR EXISTS (SELECT 1 FROM "Organization")
ON CONFLICT ("id") DO NOTHING;
