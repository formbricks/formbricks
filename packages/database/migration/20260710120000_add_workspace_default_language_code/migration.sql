-- Workspace-level default survey language (ENG: workspace default language).
-- Newly created surveys adopt this language as their default so teams whose surveys are authored in a
-- non-English language no longer start every survey in English. Nullable: an unset workspace keeps the
-- previous behavior (the creator's UI locale becomes the survey default). Stores a canonical BCP-47
-- code that mirrors one of the workspace's Language.code values; resolution guards against a stale code.

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN "defaultLanguageCode" TEXT;
