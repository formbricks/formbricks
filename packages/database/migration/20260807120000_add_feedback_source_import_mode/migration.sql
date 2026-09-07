-- ENG-2058: per-source control over which survey responses are imported into Hub.
--
-- Live ingestion only runs on responseFinished, but the historical import pulled every response
-- including partials, so the two disagreed. This column makes the choice explicit and defaults to
-- completedOnly, which is the behaviour the live path already has. Existing rows take the default;
-- nothing is re-imported retroactively.

-- CreateEnum
CREATE TYPE "FeedbackSourceImportMode" AS ENUM ('completedOnly', 'all');

-- AlterTable
ALTER TABLE "FeedbackSource" ADD COLUMN     "import_mode" "FeedbackSourceImportMode" NOT NULL DEFAULT 'completedOnly';
