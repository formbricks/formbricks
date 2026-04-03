import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import type { MigrationScript } from "../../src/scripts/migration-runner";

// Table names are from a hardcoded const array, not user input.
// $executeRawUnsafe is required because Postgres does not support parameterized identifiers.
const TABLES_TO_REPARENT = [
  "Survey",
  "Contact",
  "ActionClass",
  "ContactAttributeKey",
  "Webhook",
  "Tag",
  "Segment",
  "Integration",
  "ApiKeyEnvironment",
] as const;

interface DevEnvWithData {
  envId: string;
  workspaceId: string;
  workspaceName: string;
  organizationId: string;
}

interface MigrationPlan {
  oldEnvId: string;
  oldWorkspaceId: string;
  newWorkspaceId: string;
  newEnvId: string;
  newWorkspaceName: string;
  organizationId: string;
}

export const promoteDevEnvironments: MigrationScript = {
  type: "data",
  id: "k8m2vqwx4r1tnp6jb3yfs5ho",
  name: "20260403000001_promote_dev_environments",
  run: async ({ tx }) => {
    // Step 1: Find dev environments with data
    const devEnvsWithData: DevEnvWithData[] = await tx.$queryRaw`
      SELECT
        e."id" AS "envId",
        e."workspaceId" AS "workspaceId",
        w."name" AS "workspaceName",
        w."organizationId" AS "organizationId"
      FROM "Environment" e
      JOIN "Workspace" w ON w."id" = e."workspaceId"
      WHERE e."type" = 'development'
        AND (
          EXISTS (SELECT 1 FROM "Survey" s WHERE s."environmentId" = e."id")
          OR EXISTS (SELECT 1 FROM "Contact" c WHERE c."environmentId" = e."id")
          OR EXISTS (SELECT 1 FROM "Webhook" wh WHERE wh."environmentId" = e."id")
        )
    `;

    if (devEnvsWithData.length === 0) {
      logger.info("No dev environments with data found. Nothing to promote.");
      return;
    }

    logger.info(`Found ${devEnvsWithData.length.toString()} dev environment(s) with data to promote`);

    // Step 2: Generate IDs and resolve unique names
    // Pre-fetch all existing workspace names per org.
    // orgIds are CUIDs from our own DB query — safe to interpolate.
    const orgIds = [...new Set(devEnvsWithData.map((e) => e.organizationId))];
    const allExistingWorkspaces: { organizationId: string; name: string }[] = await tx.$queryRawUnsafe(
      `SELECT "organizationId", "name" FROM "Workspace" WHERE "organizationId" IN (${orgIds.map((id) => `'${id}'`).join(",")})`
    );

    const namesByOrg = new Map<string, Set<string>>();
    for (const ws of allExistingWorkspaces) {
      if (!namesByOrg.has(ws.organizationId)) {
        namesByOrg.set(ws.organizationId, new Set());
      }
      namesByOrg.get(ws.organizationId)!.add(ws.name);
    }

    const plans: MigrationPlan[] = [];

    for (const devEnv of devEnvsWithData) {
      const newWorkspaceId = createId();
      const newEnvId = createId();
      const orgNames = namesByOrg.get(devEnv.organizationId) ?? new Set<string>();

      // Resolve unique name
      let newName = `${devEnv.workspaceName} (Dev)`;
      if (orgNames.has(newName)) {
        let suffix = 2;
        while (orgNames.has(`${devEnv.workspaceName} (Dev ${suffix.toString()})`)) {
          suffix++;
          if (suffix > 100) {
            throw new Error(
              `Could not find unique workspace name for "${devEnv.workspaceName}" in org ${devEnv.organizationId} after 100 attempts`
            );
          }
        }
        newName = `${devEnv.workspaceName} (Dev ${suffix.toString()})`;
      }

      // Reserve the name so subsequent iterations see it
      orgNames.add(newName);

      plans.push({
        oldEnvId: devEnv.envId,
        oldWorkspaceId: devEnv.workspaceId,
        newWorkspaceId,
        newEnvId,
        newWorkspaceName: newName,
        organizationId: devEnv.organizationId,
      });
    }

    // Step 3: Create new Workspaces
    for (const plan of plans) {
      logger.info(`Creating workspace "${plan.newWorkspaceName}" (${plan.newWorkspaceId})`);

      await tx.$executeRaw`
        INSERT INTO "Workspace" (
          "id", "created_at", "updated_at", "name", "organizationId",
          "styling", "config", "recontactDays", "linkSurveyBranding",
          "inAppSurveyBranding", "placement", "clickOutsideClose",
          "overlay", "logo", "customHeadScripts"
        )
        SELECT
          ${plan.newWorkspaceId}, NOW(), NOW(), ${plan.newWorkspaceName}, ${plan.organizationId},
          w."styling", w."config", w."recontactDays", w."linkSurveyBranding",
          w."inAppSurveyBranding", w."placement", w."clickOutsideClose",
          w."overlay", w."logo", w."customHeadScripts"
        FROM "Workspace" w
        WHERE w."id" = ${plan.oldWorkspaceId}
      `;
    }

    // Step 4: Create new production Environments
    for (const plan of plans) {
      logger.info(`Creating production environment ${plan.newEnvId} for workspace ${plan.newWorkspaceId}`);

      await tx.$executeRaw`
        INSERT INTO "Environment" ("id", "created_at", "updated_at", "type", "workspaceId")
        VALUES (${plan.newEnvId}, NOW(), NOW(), 'production', ${plan.newWorkspaceId})
      `;
    }

    // Step 5: Copy WorkspaceTeam assignments
    for (const plan of plans) {
      const copied = await tx.$executeRaw`
        INSERT INTO "WorkspaceTeam" ("created_at", "updated_at", "workspaceId", "teamId", "permission")
        SELECT NOW(), NOW(), ${plan.newWorkspaceId}, wt."teamId", wt."permission"
        FROM "WorkspaceTeam" wt
        WHERE wt."workspaceId" = ${plan.oldWorkspaceId}
      `;

      logger.info(
        `Copied ${copied.toString()} WorkspaceTeam assignments to workspace ${plan.newWorkspaceId}`
      );
    }

    // Step 6: Handle Language/SurveyLanguage migration
    for (const plan of plans) {
      // Find languages referenced by surveys in this dev environment
      const referencedLanguages: { id: string; code: string; alias: string | null }[] = await tx.$queryRaw`
        SELECT DISTINCT l."id", l."code", l."alias"
        FROM "Language" l
        JOIN "SurveyLanguage" sl ON sl."languageId" = l."id"
        JOIN "Survey" s ON s."id" = sl."surveyId"
        WHERE s."environmentId" = ${plan.oldEnvId}
      `;

      if (referencedLanguages.length === 0) {
        continue;
      }

      logger.info(
        `Migrating ${referencedLanguages.length.toString()} language(s) for dev env ${plan.oldEnvId}`
      );

      // Create matching Language records in the new workspace
      for (const lang of referencedLanguages) {
        const newLangId = createId();

        // Insert with ON CONFLICT to handle duplicates (same code in same workspace)
        await tx.$executeRawUnsafe(
          `INSERT INTO "Language" ("id", "created_at", "updated_at", "code", "alias", "workspaceId")
           VALUES ($1, NOW(), NOW(), $2, $3, $4)
           ON CONFLICT ("workspaceId", "code") DO NOTHING`,
          newLangId,
          lang.code,
          lang.alias,
          plan.newWorkspaceId
        );
      }

      // For languages that already existed (ON CONFLICT hit), find their actual IDs
      const newWorkspaceLangs: { id: string; code: string }[] = await tx.$queryRaw`
        SELECT "id", "code" FROM "Language" WHERE "workspaceId" = ${plan.newWorkspaceId}
      `;

      const codeToNewLangId = new Map<string, string>();
      for (const lang of newWorkspaceLangs) {
        codeToNewLangId.set(lang.code, lang.id);
      }

      // Update SurveyLanguage rows for promoted surveys to point to new Language IDs
      for (const oldLang of referencedLanguages) {
        const newLangId = codeToNewLangId.get(oldLang.code);
        if (!newLangId || newLangId === oldLang.id) {
          continue;
        }

        await tx.$executeRaw`
          UPDATE "SurveyLanguage" sl
          SET "languageId" = ${newLangId}
          FROM "Survey" s
          WHERE sl."surveyId" = s."id"
            AND s."environmentId" = ${plan.oldEnvId}
            AND sl."languageId" = ${oldLang.id}
        `;
      }
    }

    // Step 7: Re-parent resources (9 tables)
    for (const plan of plans) {
      for (const table of TABLES_TO_REPARENT) {
        const updated = await tx.$executeRawUnsafe(
          `UPDATE "${table}"
           SET "workspaceId" = $1, "environmentId" = $2
           WHERE "environmentId" = $3`,
          plan.newWorkspaceId,
          plan.newEnvId,
          plan.oldEnvId
        );

        if (updated > 0) {
          logger.info(`Re-parented ${updated.toString()} rows in ${table} from env ${plan.oldEnvId}`);
        }
      }
    }

    // Step 8: Verification
    const failures: string[] = [];

    for (const plan of plans) {
      // Verify zero rows remain in old environment
      for (const table of TABLES_TO_REPARENT) {
        const remaining: [{ count: bigint }] = await tx.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM "${table}" WHERE "environmentId" = $1`,
          plan.oldEnvId
        );

        if (remaining[0].count > 0n) {
          failures.push(
            `${table}: ${remaining[0].count.toString()} rows still reference old env ${plan.oldEnvId}`
          );
        }
      }

      // Verify exactly one environment exists in new workspace
      const envCount: [{ count: bigint }] = await tx.$queryRaw`
        SELECT COUNT(*) as count FROM "Environment" WHERE "workspaceId" = ${plan.newWorkspaceId}
      `;

      if (envCount[0].count !== 1n) {
        failures.push(
          `New workspace ${plan.newWorkspaceId} has ${envCount[0].count.toString()} environments (expected 1)`
        );
      }

      // Log resource counts for auditability
      for (const table of TABLES_TO_REPARENT) {
        const newCount: [{ count: bigint }] = await tx.$queryRawUnsafe(
          `SELECT COUNT(*) as count FROM "${table}" WHERE "environmentId" = $1`,
          plan.newEnvId
        );

        if (newCount[0].count > 0n) {
          logger.info(
            `Workspace "${plan.newWorkspaceName}": ${newCount[0].count.toString()} rows in ${table}`
          );
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(`Promotion verification failed:\n${failures.join("\n")}`);
    }

    logger.info(
      `Successfully promoted ${plans.length.toString()} dev environment(s) to standalone workspaces`
    );
  },
};
