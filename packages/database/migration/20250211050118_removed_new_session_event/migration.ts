import type { MigrationScript } from "../../src/scripts/migration-runner";

export const removedNewSessionEvent: MigrationScript = {
  type: "data",
  id: "dnh52k9vepinuhwuur8fclqf",
  name: "20250211050118_removed_new_session_event",
  run: async ({ tx }) => {
    const updatedActions = await tx.$executeRaw`
      UPDATE "ActionClass"
      SET type = 'noCode',
          "noCodeConfig" = '{"type":"pageView","urlFilters":[]}'::jsonb
      WHERE type = 'automatic'
        AND EXISTS (
          SELECT 1 
          FROM "SurveyTrigger"
          WHERE "actionClassId" = "ActionClass".id
        )
    `;

    console.log(`Updated ${updatedActions.toString()} automatic actions`);

    // Delete actions that are not referenced in SurveyTrigger
    const deletedActions = await tx.$executeRaw`
      DELETE FROM "ActionClass"
      WHERE type = 'automatic'
        AND NOT EXISTS (
          SELECT 1 
          FROM "SurveyTrigger"
          WHERE "actionClassId" = "ActionClass".id
        )
    `;
    console.log(`Deleted ${deletedActions.toString()} automatic actions`);
  },
};
