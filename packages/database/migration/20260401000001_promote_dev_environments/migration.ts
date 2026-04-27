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
  const newIds = plans.map((p) => p.newWorkspaceId);
  const newNames = plans.map((p) => p.newWorkspaceName);
  const orgIds = plans.map((p) => p.organizationId);
  const oldWsIds = plans.map((p) => p.oldWorkspaceId);

  await tx.$executeRaw`
    INSERT INTO "Workspace" (
      "id", "created_at", "updated_at", "name", "organizationId",
      "styling", "config", "recontactDays", "linkSurveyBranding",
      "inAppSurveyBranding", "placement", "clickOutsideClose",
      "overlay", "logo", "customHeadScripts"
    )
    SELECT p.new_id, NOW(), NOW(), p.new_name, p.org_id,
      w."styling", w."config", w."recontactDays", w."linkSurveyBranding",
      w."inAppSurveyBranding", w."placement", w."clickOutsideClose",
      w."overlay", w."logo", w."customHeadScripts"
    FROM unnest(${newIds}::text[], ${newNames}::text[], ${orgIds}::text[], ${oldWsIds}::text[])
      AS p(new_id, new_name, org_id, old_ws_id)
    JOIN "Workspace" w ON w."id" = p.old_ws_id
  `;

  logger.info(`Created ${plans.length.toString()} new workspace(s)`);
}

// -- Step 4 --
// Move the existing dev environment into the new workspace and promote it to production.
// This preserves the environment ID so existing API keys and SDK integrations continue to work.
async function promoteEnvironments(tx: TxClient, plans: MigrationPlan[]): Promise<void> {
  const oldEnvIds = plans.map((p) => p.oldEnvId);
  const newWsIds = plans.map((p) => p.newWorkspaceId);

  await tx.$executeRaw`
    UPDATE "Environment" e
    SET "workspaceId" = p.new_ws_id, "type" = 'production', "updated_at" = NOW()
    FROM unnest(${oldEnvIds}::text[], ${newWsIds}::text[]) AS p(old_env_id, new_ws_id)
    WHERE e."id" = p.old_env_id
  `;

  logger.info(`Promoted ${plans.length.toString()} dev environment(s) to production in new workspaces`);
}

// -- Step 5 --
async function copyTeamAssignments(tx: TxClient, plans: MigrationPlan[]): Promise<void> {
  const oldWsIds = plans.map((p) => p.oldWorkspaceId);
  const newWsIds = plans.map((p) => p.newWorkspaceId);

  const totalCopied = await tx.$executeRaw`
    INSERT INTO "WorkspaceTeam" ("created_at", "updated_at", "workspaceId", "teamId", "permission")
    SELECT NOW(), NOW(), p.new_ws_id, wt."teamId", wt."permission"
    FROM unnest(${oldWsIds}::text[], ${newWsIds}::text[]) AS p(old_ws_id, new_ws_id)
    JOIN "WorkspaceTeam" wt ON wt."workspaceId" = p.old_ws_id
  `;

  logger.info(
    `Copied ${totalCopied.toString()} WorkspaceTeam assignment(s) across ${plans.length.toString()} workspace(s)`
  );
}

// -- Step 6 --
async function migrateLanguages(tx: TxClient, plans: MigrationPlan[]): Promise<void> {
  const oldEnvIds = plans.map((p) => p.oldEnvId);
  const envToNewWs = new Map(plans.map((p) => [p.oldEnvId, p.newWorkspaceId]));

  // Gather every referenced language across all promoted envs in one query
  const refs: { oldEnvId: string; oldLangId: string; code: string; alias: string | null }[] =
    await tx.$queryRaw`
      SELECT DISTINCT s."environmentId" AS "oldEnvId", l."id" AS "oldLangId", l."code", l."alias"
      FROM "Language" l
      JOIN "SurveyLanguage" sl ON sl."languageId" = l."id"
      JOIN "Survey" s ON s."id" = sl."surveyId"
      WHERE s."environmentId" = ANY(${oldEnvIds}::text[])
    `;

  if (refs.length === 0) {
    return;
  }

  // Dedupe by (newWorkspaceId, code); pre-mint cuid2 ids in JS
  const keyOf = (ws: string, code: string) => `${ws}|${code}`;
  const newLangRows = new Map<string, { id: string; code: string; alias: string | null; wsId: string }>();

  for (const r of refs) {
    const newWs = envToNewWs.get(r.oldEnvId);
    if (!newWs) continue;
    const k = keyOf(newWs, r.code);
    if (!newLangRows.has(k)) {
      newLangRows.set(k, { id: createId(), code: r.code, alias: r.alias, wsId: newWs });
    }
  }

  const rows = [...newLangRows.values()];
  const langIds = rows.map((r) => r.id);
  const langCodes = rows.map((r) => r.code);
  const langAliases = rows.map((r) => r.alias);
  const langWsIds = rows.map((r) => r.wsId);

  // Bulk insert languages. New workspaces are freshly created so no existing rows;
  // dedupe above guarantees no intra-batch conflicts either.
  await tx.$executeRaw`
    INSERT INTO "Language" ("id", "created_at", "updated_at", "code", "alias", "workspaceId")
    SELECT p.id, NOW(), NOW(), p.code, p.alias, p.ws_id
    FROM unnest(${langIds}::text[], ${langCodes}::text[], ${langAliases}::text[], ${langWsIds}::text[])
      AS p(id, code, alias, ws_id)
  `;

  // Build (oldEnvId, oldLangId, newLangId) triples and bulk UPDATE SurveyLanguage
  const updEnvs: string[] = [];
  const updOldLangs: string[] = [];
  const updNewLangs: string[] = [];

  for (const r of refs) {
    const newWs = envToNewWs.get(r.oldEnvId);
    if (!newWs) continue;
    const newLangId = newLangRows.get(keyOf(newWs, r.code))?.id;
    if (!newLangId || newLangId === r.oldLangId) continue;
    updEnvs.push(r.oldEnvId);
    updOldLangs.push(r.oldLangId);
    updNewLangs.push(newLangId);
  }

  if (updEnvs.length > 0) {
    await tx.$executeRaw`
      UPDATE "SurveyLanguage" sl
      SET "languageId" = m.new_lang_id
      FROM unnest(${updEnvs}::text[], ${updOldLangs}::text[], ${updNewLangs}::text[])
           AS m(old_env_id, old_lang_id, new_lang_id),
           "Survey" s
      WHERE s."id" = sl."surveyId"
        AND s."environmentId" = m.old_env_id
        AND sl."languageId" = m.old_lang_id
    `;
  }
}

// -- Step 7 --
async function verifyMigration(tx: TxClient, plans: MigrationPlan[]): Promise<void> {
  const failures: string[] = [];
  const oldEnvIds = plans.map((p) => p.oldEnvId);
  const newWsIds = plans.map((p) => p.newWorkspaceId);

  // Fetch all promoted envs in one query
  const envs: { id: string; workspaceId: string; type: string }[] = await tx.$queryRaw`
    SELECT "id", "workspaceId", "type" FROM "Environment"
    WHERE "id" = ANY(${oldEnvIds}::text[])
  `;
  const envById = new Map(envs.map((e) => [e.id, e]));

  // Count envs per new workspace in one query
  const counts: { workspaceId: string; count: bigint }[] = await tx.$queryRaw`
    SELECT "workspaceId", COUNT(*) AS count FROM "Environment"
    WHERE "workspaceId" = ANY(${newWsIds}::text[])
    GROUP BY "workspaceId"
  `;
  const countByWs = new Map(counts.map((c) => [c.workspaceId, c.count]));

  for (const plan of plans) {
    const env = envById.get(plan.oldEnvId);
    if (!env) {
      failures.push(`Environment ${plan.oldEnvId} not found`);
      continue;
    }

    if (env.workspaceId !== plan.newWorkspaceId) {
      failures.push(
        `Environment ${plan.oldEnvId} still points to workspace ${env.workspaceId} (expected ${plan.newWorkspaceId})`
      );
    }

    if (env.type !== "production") {
      failures.push(`Environment ${plan.oldEnvId} type is "${env.type}" (expected "production")`);
    }

    const cnt = countByWs.get(plan.newWorkspaceId) ?? 0n;
    if (cnt !== 1n) {
      failures.push(`New workspace ${plan.newWorkspaceId} has ${cnt.toString()} environments (expected 1)`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Promotion verification failed:\n${failures.join("\n")}`);
  }

  logger.info(`Verification passed for ${plans.length.toString()} promoted environment(s)`);
}

// -- Step 8 --
async function deleteRemainingDevEnvironments(tx: TxClient): Promise<void> {
  const BATCH_SIZE = 500;
  let total = 0;
  let batch = 0;

  while (true) {
    const deleted = await tx.$executeRaw`
      DELETE FROM "Environment"
      WHERE "id" IN (
        SELECT "id" FROM "Environment"
        WHERE "type" = 'development'
        LIMIT ${BATCH_SIZE}
      )
    `;
    if (deleted === 0) break;
    total += deleted;
    batch++;
    logger.info({ batch, deleted, total }, "Deleted batch of remaining dev environments");
  }

  logger.info({ batches: batch, total }, "Finished deleting remaining dev environments");
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
