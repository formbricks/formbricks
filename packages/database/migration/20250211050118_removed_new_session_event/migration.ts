import type { MigrationScript } from "../../src/scripts/migration-runner";

export const removedNewSessionEvent: MigrationScript = {
  type: "data",
  id: "dnh52k9vepinuhwuur8fclqf",
  name: "20250211050118_removed_new_session_event",
  run: async ({ tx }) => {
    // Find all "New Session" actions
    const newSessionActionsResult = await tx.$queryRaw`
      SELECT id, name 
      FROM "ActionClass" 
      WHERE name = 'New Session' AND type = 'automatic'
    `;

    const newSessionActions = newSessionActionsResult as { id: string; name: string }[];

    console.log(`Found ${newSessionActions.length.toString()} new session actions`);

    let updatedActions = 0;
    let deletedActions = 0;

    for (const action of newSessionActions) {
      // Check for survey triggers using this action
      const surveyTriggersResult = await tx.$queryRaw`
        SELECT id 
        FROM "SurveyTrigger" 
        WHERE "actionClassId" = ${action.id}
      `;

      const surveyTriggers = surveyTriggersResult as { id: string }[];

      if (surveyTriggers.length > 0) {
        // Update action to noCode type
        await tx.$executeRaw`
          UPDATE "ActionClass"
          SET type = 'noCode',
              "noCodeConfig" = '{"type":"pageView","urlFilters":[]}'::jsonb
          WHERE id = ${action.id}
        `;
        updatedActions++;
      } else {
        // Delete unused action
        await tx.$executeRaw`
          DELETE FROM "ActionClass"
          WHERE id = ${action.id}
        `;
        deletedActions++;
      }
    }

    console.log(
      `Updated ${updatedActions.toString()} new session actions and deleted ${deletedActions.toString()} new session actions`
    );

    console.log("Updating the rest of the automatic actions to noCode type");

    const updatedActionsResult = await tx.$executeRaw`
      UPDATE "ActionClass"
      SET type = 'noCode'
      WHERE type = 'automatic'
    `;

    console.log(`Updated ${updatedActionsResult.toString()} automatic actions`);
  },
};
