-- AlterTable: Add overlay column (enum), migrate data, drop darkOverlay

-- Step 1: Create the SurveyOverlay enum type
CREATE TYPE "SurveyOverlay" AS ENUM ('none', 'light', 'dark');

-- Step 2: Add the new overlay column with the enum type and default value
ALTER TABLE "Project" ADD COLUMN "overlay" "SurveyOverlay" NOT NULL DEFAULT 'none';

-- Step 3: Migrate existing data
-- For center placement: darkOverlay=true -> 'dark', darkOverlay=false -> 'light'
-- For other placements: always 'none' (since overlay wasn't shown before)
UPDATE "Project" 
SET "overlay" = CASE 
  WHEN "placement" = 'center' AND "darkOverlay" = true THEN 'dark'::"SurveyOverlay"
  WHEN "placement" = 'center' AND "darkOverlay" = false THEN 'light'::"SurveyOverlay"
  ELSE 'none'::"SurveyOverlay"
END;

-- Step 4: Drop the old darkOverlay column
ALTER TABLE "Project" DROP COLUMN "darkOverlay";
