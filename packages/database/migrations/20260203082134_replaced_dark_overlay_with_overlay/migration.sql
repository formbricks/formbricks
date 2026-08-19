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

-- Step 5: Migrate Survey.projectOverwrites JSON field
-- Only convert darkOverlay -> overlay when placement is explicitly 'center' in projectOverwrites
-- For all other cases, just remove darkOverlay (survey will inherit overlay from project)

-- Case 5a: Survey has placement: 'center' explicitly in projectOverwrites - convert darkOverlay to overlay
UPDATE "Survey"
SET "projectOverwrites" = jsonb_set(
  "projectOverwrites"::jsonb - 'darkOverlay',
  '{overlay}',
  CASE 
    WHEN ("projectOverwrites"::jsonb->>'darkOverlay') = 'true' THEN '"dark"'::jsonb
    ELSE '"light"'::jsonb
  END
)
WHERE "projectOverwrites" IS NOT NULL 
  AND "projectOverwrites"::jsonb ? 'darkOverlay'
  AND ("projectOverwrites"::jsonb->>'placement') = 'center';

-- Case 5b: Any remaining surveys with darkOverlay (placement != 'center' or not present) - just remove darkOverlay
-- These surveys will inherit the overlay setting from their project
UPDATE "Survey"
SET "projectOverwrites" = "projectOverwrites"::jsonb - 'darkOverlay'
WHERE "projectOverwrites" IS NOT NULL 
  AND "projectOverwrites"::jsonb ? 'darkOverlay';
