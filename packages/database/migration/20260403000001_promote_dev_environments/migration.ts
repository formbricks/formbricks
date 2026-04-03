import { createId } from "@paralleldrive/cuid2";
import { Prisma } from "@prisma/client";
import { logger } from "@formbricks/logger";
import type { DataMigrationContext, MigrationScript } from "../../src/scripts/migration-runner";

type TxClient = DataMigrationContext["tx"];

// Table names are from a hardcoded const array, not user input.
// $executeRawUnsafe is required because Postgres does not support parameterized identifiers.
//
// Tables NOT listed here need no re-parenting because they have no environmentId/workspaceId columns
// and follow their parent via FK cascade:
//   - Response, Display → reference Survey by surveyId (unchanged)
//   - ContactAttribute → references Contact by contactId (unchanged)
//   - TagsOnResponses, SurveyTrigger, SurveyQuota, SurveyFollowUp → reference Survey/Response by ID
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
        OR EXISTS (SELECT 1 FROM "Webhook" wh WHERE wh."environmentId" = e."id")
      )
  `;
}

// -- Step 2 --
async function buildMigrationPlans(tx: TxClient, devEnvs: DevEnvWithData[]): Promise<MigrationPlan[]> {
  const orgIds = [...new Set(devEnvs.map((e) => e.organizationId))];
  const allExistingWorkspaces: { organizationId: string; name: string }[] = await tx.$queryRaw`
    SELECT "organizationId", "name" FROM "Workspace"
    WHERE "organizationId" IN (${Prisma.join(orgIds)})
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
    const newEnvId = createId();
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
      newEnvId,
      newWorkspaceName: newName,
      organizationId: devEnv.organizationId,
    });
  }

  return plans;
}

// -- Step 3 --
async function createWorkspaces(tx: TxClient, plans: MigrationPlan[]): Promise<void> {
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
}

// -- Step 4 --
// appSetupCompleted is intentionally not copied: the promoted workspace is a new standalone
// workspace with a fresh production environment. SDK setup must be re-done against the new env.
async function createEnvironments(tx: TxClient, plans: MigrationPlan[]): Promise<void> {
  for (const plan of plans) {
    logger.info(`Creating production environment ${plan.newEnvId} for workspace ${plan.newWorkspaceId}`);

    await tx.$executeRaw`
      INSERT INTO "Environment" ("id", "created_at", "updated_at", "type", "workspaceId")
      VALUES (${plan.newEnvId}, NOW(), NOW(), 'production', ${plan.newWorkspaceId})
    `;
  }
}

// -- Step 5 --
async function copyTeamAssignments(tx: TxClient, plans: MigrationPlan[]): Promise<void> {
  for (const plan of plans) {
    const copied = await tx.$executeRaw`
      INSERT INTO "WorkspaceTeam" ("created_at", "updated_at", "workspaceId", "teamId", "permission")
      SELECT NOW(), NOW(), ${plan.newWorkspaceId}, wt."teamId", wt."permission"
      FROM "WorkspaceTeam" wt
      WHERE wt."workspaceId" = ${plan.oldWorkspaceId}
    `;

    logger.info(`Copied ${copied.toString()} WorkspaceTeam assignments to workspace ${plan.newWorkspaceId}`);
  }
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

    logger.info(
      `Migrating ${referencedLanguages.length.toString()} language(s) for dev env ${plan.oldEnvId}`
    );

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
async function reparentResources(
  tx: TxClient,
  plans: MigrationPlan[]
): Promise<Map<string, Map<string, number>>> {
  // Capture before-counts for verification
  const beforeCounts = new Map<string, Map<string, number>>();
  for (const plan of plans) {
    const tableCounts = new Map<string, number>();
    for (const table of TABLES_TO_REPARENT) {
      const result: [{ count: bigint }] = await tx.$queryRawUnsafe(
        `SELECT COUNT(*) as count FROM "${table}" WHERE "environmentId" = $1`,
        plan.oldEnvId
      );
      tableCounts.set(table, Number(result[0].count));
    }
    beforeCounts.set(plan.oldEnvId, tableCounts);
  }

  // The new environment is empty before re-parenting, so unique constraints scoped to
  // environmentId (e.g. on Tag, ActionClass, Integration, Segment) cannot conflict.
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

  return beforeCounts;
}

// -- Step 8 --
async function verifyPlan(
  tx: TxClient,
  plan: MigrationPlan,
  expectedCounts: Map<string, number> | undefined
): Promise<string[]> {
  const failures: string[] = [];

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

  // Verify before/after counts match
  const summary: string[] = [];
  for (const table of TABLES_TO_REPARENT) {
    const newCount: [{ count: bigint }] = await tx.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "${table}" WHERE "environmentId" = $1`,
      plan.newEnvId
    );

    const actual = Number(newCount[0].count);
    const expected = expectedCounts?.get(table) ?? 0;

    if (actual !== expected) {
      failures.push(
        `${table}: expected ${expected.toString()} rows in new env ${plan.newEnvId}, got ${actual.toString()}`
      );
    }

    if (actual > 0) {
      summary.push(`${table}=${actual.toString()}`);
    }
  }

  // Single log line per workspace for auditability
  if (summary.length > 0) {
    logger.info(`Workspace "${plan.newWorkspaceName}": ${summary.join(", ")}`);
  }

  return failures;
}

async function verifyMigration(
  tx: TxClient,
  plans: MigrationPlan[],
  beforeCounts: Map<string, Map<string, number>>
): Promise<void> {
  const startMs = Date.now();
  const failures: string[] = [];

  for (const plan of plans) {
    const planFailures = await verifyPlan(tx, plan, beforeCounts.get(plan.oldEnvId));
    failures.push(...planFailures);
  }

  const elapsedMs = Date.now() - startMs;
  logger.info(`Verification completed in ${elapsedMs.toString()}ms`);

  if (failures.length > 0) {
    throw new Error(`Promotion verification failed:\n${failures.join("\n")}`);
  }
}

// -- Migration entry point --
export const promoteDevEnvironments: MigrationScript = {
  type: "data",
  id: "k8m2vqwx4r1tnp6jb3yfs5ho",
  name: "20260403000001_promote_dev_environments",
  run: async ({ tx }) => {
    // Expected volume is small (tens of dev envs with data at most).
    // Steps use per-plan loops for readability; acceptable at this cardinality.
    const devEnvsWithData = await findDevEnvsWithData(tx);

    if (devEnvsWithData.length === 0) {
      logger.info("No dev environments with data found. Nothing to promote.");
      return;
    }

    logger.info(`Found ${devEnvsWithData.length.toString()} dev environment(s) with data to promote`);

    const plans = await buildMigrationPlans(tx, devEnvsWithData);
    await createWorkspaces(tx, plans);
    await createEnvironments(tx, plans);
    await copyTeamAssignments(tx, plans);
    await migrateLanguages(tx, plans);
    const beforeCounts = await reparentResources(tx, plans);
    await verifyMigration(tx, plans, beforeCounts);

    logger.info(
      `Successfully promoted ${plans.length.toString()} dev environment(s) to standalone workspaces`
    );
  },
};
