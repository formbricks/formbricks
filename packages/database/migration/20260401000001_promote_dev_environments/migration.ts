import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import type { DataMigrationContext, MigrationScript } from "../../src/scripts/migration-runner";

type TxClient = DataMigrationContext["tx"];

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
  newWorkspaceName: string;
  organizationId: string;
}

// -- Step 1 --
async function findDevEnvsWithData(tx: TxClient): Promise<DevEnvWithData[]> {
  return tx.$queryRaw`
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
        OR EXISTS (SELECT 1 FROM "ActionClass" ac WHERE ac."environmentId" = e."id")
        OR EXISTS (SELECT 1 FROM "Webhook" wh WHERE wh."environmentId" = e."id")
        OR EXISTS (SELECT 1 FROM "Tag" t WHERE t."environmentId" = e."id")
        OR EXISTS (SELECT 1 FROM "Segment" seg WHERE seg."environmentId" = e."id")
        OR EXISTS (SELECT 1 FROM "Integration" i WHERE i."environmentId" = e."id")
        OR EXISTS (SELECT 1 FROM "ApiKeyEnvironment" ake WHERE ake."environmentId" = e."id")
        -- ContactAttributeKey excluded: every environment has 5 default rows (userId, email,
        -- firstName, lastName, language) auto-created, which don't indicate real usage.
      )
  `;
}

// -- Step 2 --
async function buildMigrationPlans(tx: TxClient, devEnvs: DevEnvWithData[]): Promise<MigrationPlan[]> {
  // Use a subquery instead of IN(...) to avoid the 32,767 bind variable limit
  const allExistingWorkspaces: { organizationId: string; name: string }[] = await tx.$queryRaw`
    SELECT w."organizationId", w."name" FROM "Workspace" w
    WHERE w."organizationId" IN (
      SELECT DISTINCT w2."organizationId"
      FROM "Environment" e
      JOIN "Workspace" w2 ON w2."id" = e."workspaceId"
      WHERE e."type" = 'development'
    )
  `;

  const namesByOrg = new Map<string, Set<string>>();
  for (const ws of allExistingWorkspaces) {
    const existing = namesByOrg.get(ws.organizationId);
    if (existing) {
      existing.add(ws.name);
    } else {
      namesByOrg.set(ws.organizationId, new Set([ws.name]));
    }
  }

  const plans: MigrationPlan[] = [];

  for (const devEnv of devEnvs) {
    const newWorkspaceId = createId();
    const orgNames = namesByOrg.get(devEnv.organizationId) ?? new Set<string>();

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
      newWorkspaceName: newName,
      organizationId: devEnv.organizationId,
    });
  }

  return plans;
}

// -- Step 3 --
async function createWorkspaces(tx: TxClient, plans: MigrationPlan[]): Promise<void> {
  for (const plan of plans) {
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

  logger.info(`Created ${plans.length.toString()} new workspace(s)`);
}

// -- Step 4 --
// Move the existing dev environment into the new workspace and promote it to production.
// This preserves the environment ID so existing API keys and SDK integrations continue to work.
async function promoteEnvironments(tx: TxClient, plans: MigrationPlan[]): Promise<void> {
  for (const plan of plans) {
    await tx.$executeRaw`
      UPDATE "Environment"
      SET "workspaceId" = ${plan.newWorkspaceId}, "type" = 'production', "updated_at" = NOW()
      WHERE "id" = ${plan.oldEnvId}
    `;
  }

  logger.info(`Promoted ${plans.length.toString()} dev environment(s) to production in new workspaces`);
}

// -- Step 5 --
async function copyTeamAssignments(tx: TxClient, plans: MigrationPlan[]): Promise<void> {
  let totalCopied = 0;

  for (const plan of plans) {
    const copied = await tx.$executeRaw`
      INSERT INTO "WorkspaceTeam" ("created_at", "updated_at", "workspaceId", "teamId", "permission")
      SELECT NOW(), NOW(), ${plan.newWorkspaceId}, wt."teamId", wt."permission"
      FROM "WorkspaceTeam" wt
      WHERE wt."workspaceId" = ${plan.oldWorkspaceId}
    `;

    totalCopied += copied;
  }

  logger.info(
    `Copied ${totalCopied.toString()} WorkspaceTeam assignment(s) across ${plans.length.toString()} workspace(s)`
  );
}

// -- Step 6 --
async function migrateLanguages(tx: TxClient, plans: MigrationPlan[]): Promise<void> {
  for (const plan of plans) {
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

    // For languages where ON CONFLICT was hit, find their actual IDs
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
}

// -- Step 7 --
async function verifyMigration(tx: TxClient, plans: MigrationPlan[]): Promise<void> {
  const failures: string[] = [];

  for (const plan of plans) {
    // Verify the environment now belongs to the new workspace
    const env: [{ workspaceId: string; type: string }] = await tx.$queryRaw`
      SELECT "workspaceId", "type" FROM "Environment" WHERE "id" = ${plan.oldEnvId}
    `;

    if (env[0].workspaceId !== plan.newWorkspaceId) {
      failures.push(
        `Environment ${plan.oldEnvId} still points to workspace ${env[0].workspaceId} (expected ${plan.newWorkspaceId})`
      );
    }

    if (env[0].type !== "production") {
      failures.push(`Environment ${plan.oldEnvId} type is "${env[0].type}" (expected "production")`);
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
  }

  if (failures.length > 0) {
    throw new Error(`Promotion verification failed:\n${failures.join("\n")}`);
  }

  logger.info(`Verification passed for ${plans.length.toString()} promoted environment(s)`);
}

// -- Step 8 --
async function deleteRemainingDevEnvironments(tx: TxClient): Promise<void> {
  const deleted = await tx.$executeRaw`
    DELETE FROM "Environment" WHERE "type" = 'development'
  `;

  logger.info(`Deleted ${deleted.toString()} remaining dev environment(s)`);
}

// -- Migration entry point --
export const promoteDevEnvironments: MigrationScript = {
  type: "data",
  id: "k8m2vqwx4r1tnp6jb3yfs5ho",
  name: "20260401000001_promote_dev_environments",
  run: async ({ tx }) => {
    const devEnvsWithData = await findDevEnvsWithData(tx);

    if (devEnvsWithData.length === 0) {
      logger.info("No dev environments with data found. Nothing to promote.");
    } else {
      logger.info(`Found ${devEnvsWithData.length.toString()} dev environment(s) with data to promote`);

      const plans = await buildMigrationPlans(tx, devEnvsWithData);
      await createWorkspaces(tx, plans);
      await promoteEnvironments(tx, plans);
      await copyTeamAssignments(tx, plans);
      await migrateLanguages(tx, plans);
      await verifyMigration(tx, plans);

      logger.info(
        `Successfully promoted ${plans.length.toString()} dev environment(s) to standalone workspaces`
      );
    }

    // Delete remaining dev environments — promoted ones are now production,
    // non-promoted ones had no real data (FK cascade cleans up defaults like ContactAttributeKey)
    await deleteRemainingDevEnvironments(tx);
  },
};
