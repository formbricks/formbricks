import { Prisma } from "@prisma/client";
import type { MigrationScript } from "../../src/scripts/migration-runner";

export const removedNewSessionEvent: MigrationScript = {
  type: "data",
  id: "dnh52k9vepinuhwuur8fclqf",
  name: "20250211050118_removed_new_session_event",
  run: async ({ tx }) => {
    // Find all automatic actions - these are all the "New Session" actions
    const automaticActionsResult = await tx.$queryRaw`
      SELECT id, name 
      FROM "ActionClass" 
      WHERE type = 'automatic'
    `;

    const automaticActions = automaticActionsResult as { id: string; name: string }[];

    console.log(`Found ${automaticActions.length.toString()} new session actions`);

    const actionsToUpdate = [];
    const actionsToDelete = [];

    for (const action of automaticActions) {
      // Check for survey triggers using this action
      const surveyTriggersResult = await tx.$queryRaw`
        SELECT id
        FROM "SurveyTrigger"
        WHERE "actionClassId" = ${action.id}
      `;

      const surveyTriggers = surveyTriggersResult as { id: string }[];

      if (surveyTriggers.length > 0) {
        actionsToUpdate.push(action.id);
      } else {
        actionsToDelete.push(action.id);
      }
    }

    // batches:
    const batchSize = 20000;

    for (let i = 0; i < actionsToUpdate.length; i += batchSize) {
      const batch = actionsToUpdate.slice(i, i + batchSize);

      const updatedActions = await tx.$executeRaw`
        UPDATE "ActionClass"
        SET type = 'noCode',
            "noCodeConfig" = '{"type":"pageView","urlFilters":[]}'::jsonb
        WHERE id IN (${Prisma.join(batch)})
      `;

      console.log(`Updated ${updatedActions.toString()} actions`);
    }

    for (let i = 0; i < actionsToDelete.length; i += batchSize) {
      const batch = actionsToDelete.slice(i, i + batchSize);

      const deletedActions = await tx.$executeRaw`
        DELETE FROM "ActionClass" WHERE id IN (${Prisma.join(batch)})
      `;

      console.log(`Deleted ${deletedActions.toString()} actions`);
    }
  },
};
