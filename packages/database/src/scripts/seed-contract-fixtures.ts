/**
 * Seeds the disposable resources the v3 OpenAPI contract tests mutate, and writes the id map the
 * Schemathesis hooks read (see docs/api-v3-reference/contract-tests/).
 *
 * Why a separate set of resources: Schemathesis executes one case per operation in no guaranteed
 * order, so pointing `DELETE /api/v3/surveys/{surveyId}` at the same survey `GET` reads would make
 * coverage depend on execution order. Every mutating operation therefore gets its own victim, which
 * keeps the read fixtures intact and lets the destructive operations answer their real 200/204 so
 * those response shapes are schema-checked too.
 *
 * Requires `db:seed` to have run first (the workspace and the trigger survey come from there). The
 * id map is written to docs/api-v3-reference/contract-tests/fixtures.json unless `--out` says
 * otherwise.
 */
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { logger } from "@formbricks/logger";
import { type TSurveyBlocks } from "@formbricks/types/surveys/blocks";
import type { TWorkflowDefinition } from "@formbricks/workflows";
import { PrismaClient } from "../prisma";
import { createPrismaPgAdapter } from "../prisma-adapter";
import { SEED_IDS } from "../seed/constants";

const prisma = new PrismaClient({ adapter: createPrismaPgAdapter().adapter });

// This script writes rows and re-archives surveys by fixed id; same posture as seed.ts, which it
// depends on anyway. Refuse to run against a production database unless someone says otherwise.
if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
  logger.error("ERROR: Seeding blocked in production. Set ALLOW_SEED=true to override.");
  process.exit(1);
}

/** Fixed ids so the hook map is static. Lowercase alphanumeric to satisfy the routes' `z.cuid2()`. */
const CONTRACT_IDS = {
  SURVEY_READ: "clctsurveyread0000000001",
  SURVEY_PATCH: "clctsurveypatch000000001",
  SURVEY_DELETE: "clctsurveydelete00000001",
  SURVEY_ARCHIVE: "clctsurveyarchive0000001",
  SURVEY_RESTORE: "clctsurveyrestore0000001",
  WORKFLOW_PATCH: "clctworkflowpatch0000001",
  WORKFLOW_DELETE: "clctworkflowdelete000001",
  WORKFLOW_DUPLICATE: "clctworkflowduplicate001",
  WORKFLOW_ENABLE: "clctworkflowenable000001",
  WORKFLOW_DISABLE: "clctworkflowdisable00001",
  WORKFLOW_ARCHIVE: "clctworkflowarchive00001",
  WORKFLOW_UNARCHIVE: "clctworkflowunarchive001",
  ACTION_CLASS_READ: "clctactionclassread00001",
} as const;

/**
 * Where the id map goes. Defaults to the contract-tests directory that reads it, resolved from this
 * file rather than the working directory — `pnpm --filter` runs scripts from the package root, so a
 * caller-supplied relative path would mean something different from what the caller typed.
 */
function getOutPath(): string {
  const index = process.argv.indexOf("--out");
  const override = index === -1 ? undefined : process.argv[index + 1];

  if (override) {
    return resolve(process.cwd(), override);
  }

  return fileURLToPath(
    new URL("../../../../docs/api-v3-reference/contract-tests/fixtures.json", import.meta.url)
  );
}

/**
 * Languages the `lang` examples on `GET /api/v3/surveys/{surveyId}` ask for. The endpoint answers a
 * documented 400 for a language the survey does not configure, so without these the whole operation
 * only ever exercises its error path and the survey resource schema — the largest in the contract —
 * is never validated.
 */
const READ_SURVEY_LANGUAGES = ["en-US", "de-DE", "pt-PT", "zh-Hans", "zh-Hans-CN"] as const;

async function seedSurveyLanguages(surveyId: string, codes: readonly string[]): Promise<void> {
  for (const [index, code] of codes.entries()) {
    const language = await prisma.language.upsert({
      where: { workspaceId_code: { workspaceId: SEED_IDS.WORKSPACE, code } },
      update: {},
      create: { code, workspaceId: SEED_IDS.WORKSPACE },
    });

    await prisma.surveyLanguage.upsert({
      where: { languageId_surveyId: { languageId: language.id, surveyId } },
      update: { enabled: true, default: index === 0 },
      create: { languageId: language.id, surveyId, enabled: true, default: index === 0 },
    });
  }
}

async function seedSurvey(id: string, name: string, archived: boolean): Promise<void> {
  const blocks = [
    {
      id: `${id}block`,
      name: "Main Block",
      elements: [
        {
          id: `${id}element`,
          type: "openText",
          headline: { default: "Contract fixture question" },
          required: false,
        },
      ],
    },
  ] as unknown as TSurveyBlocks;

  const fields = {
    name,
    workspaceId: SEED_IDS.WORKSPACE,
    status: "inProgress" as const,
    type: "link" as const,
    blocks,
    archivedAt: archived ? new Date() : null,
  };

  await prisma.survey.upsert({ where: { id }, update: fields, create: { id, ...fields } });
}

async function seedWorkflow(
  id: string,
  name: string,
  status: "draft" | "enabled" | "disabled" | "archived"
): Promise<void> {
  const triggerId = `${id}trigger`;
  const actionId = `${id}action`;

  const definition: TWorkflowDefinition = {
    schemaVersion: 1,
    entryNodeId: triggerId,
    trigger: {
      id: triggerId,
      type: "trigger",
      triggerType: "response.completed",
      config: { surveyId: SEED_IDS.SURVEY_KITCHEN_SINK, endingCardIds: [] },
      ui: { position: { x: 220, y: 80 } },
    },
    nodes: [
      {
        id: actionId,
        type: "action",
        actionType: "send_email",
        label: "Send email",
        config: {
          to: "contract-fixture@example.com",
          from: "team@example.com",
          replyTo: [],
          subject: "Contract fixture",
          body: "Contract fixture body.",
          attachResponseData: false,
        },
        ui: { position: { x: 220, y: 200 } },
      },
    ],
    edges: [{ id: `${id}edge`, source: triggerId, target: actionId }],
  };

  const fields = {
    name,
    description: "Disposable fixture for the v3 API contract tests.",
    status,
    definition,
    workspaceId: SEED_IDS.WORKSPACE,
  };

  await prisma.workflow.upsert({ where: { id }, update: fields, create: { id, ...fields } });
}

async function main(): Promise<void> {
  const outPath = getOutPath();

  const workspace = await prisma.workspace.findUnique({ where: { id: SEED_IDS.WORKSPACE } });
  if (!workspace) {
    throw new Error(`Workspace ${SEED_IDS.WORKSPACE} is missing — run \`db:seed\` before this script.`);
  }

  await seedSurvey(CONTRACT_IDS.SURVEY_READ, "Contract fixture — read", false);
  await seedSurveyLanguages(CONTRACT_IDS.SURVEY_READ, READ_SURVEY_LANGUAGES);
  await seedSurvey(CONTRACT_IDS.SURVEY_PATCH, "Contract fixture — patch", false);
  await seedSurvey(CONTRACT_IDS.SURVEY_DELETE, "Contract fixture — delete", false);
  await seedSurvey(CONTRACT_IDS.SURVEY_ARCHIVE, "Contract fixture — archive", false);
  // Restore only has something to do on an already-archived survey.
  await seedSurvey(CONTRACT_IDS.SURVEY_RESTORE, "Contract fixture — restore", true);

  await seedWorkflow(CONTRACT_IDS.WORKFLOW_PATCH, "Contract fixture — patch", "draft");
  await seedWorkflow(CONTRACT_IDS.WORKFLOW_DELETE, "Contract fixture — delete", "draft");
  await seedWorkflow(CONTRACT_IDS.WORKFLOW_DUPLICATE, "Contract fixture — duplicate", "draft");
  // `enable` only accepts draft/disabled rows; `disable` and `archive` need a live one.
  await seedWorkflow(CONTRACT_IDS.WORKFLOW_ENABLE, "Contract fixture — enable", "draft");
  await seedWorkflow(CONTRACT_IDS.WORKFLOW_DISABLE, "Contract fixture — disable", "enabled");
  await seedWorkflow(CONTRACT_IDS.WORKFLOW_ARCHIVE, "Contract fixture — archive", "enabled");
  await seedWorkflow(CONTRACT_IDS.WORKFLOW_UNARCHIVE, "Contract fixture — unarchive", "archived");

  // An empty collection response satisfies the list schema without ever validating an item, so the
  // read fixtures below exist to put at least one row in front of every list endpoint.
  await prisma.actionClass.upsert({
    where: { id: CONTRACT_IDS.ACTION_CLASS_READ },
    update: {},
    create: {
      id: CONTRACT_IDS.ACTION_CLASS_READ,
      name: "Contract fixture — action class",
      description: "Disposable fixture for the v3 API contract tests.",
      type: "code",
      key: "contract-fixture-action",
      workspaceId: SEED_IDS.WORKSPACE,
    },
  });

  // No tag fixtures: every /api/v3/tags operation is `auth: "session"`, so an API key is rejected
  // with a documented 401 before a handler ever looks for a row. Seeding them would read as coverage
  // that does not exist. Add them here if tags ever accept an API key.

  const workflowRun = await prisma.workflowRun.findFirst({
    where: { workspaceId: SEED_IDS.WORKSPACE },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  /**
   * Consumed by docs/api-v3-reference/contract-tests/hooks.py. `read` is keyed by parameter name and
   * applies to any operation without a more specific entry; `operations` is keyed by operationId and
   * wins over it. Anything absent from both keeps its generated value and gets the documented 403.
   */
  const fixtures = {
    workspaceId: SEED_IDS.WORKSPACE,
    read: {
      surveyId: CONTRACT_IDS.SURVEY_READ,
      workflowId: SEED_IDS.WORKFLOW_RESPONSE_FOLLOW_UP,
      ...(workflowRun ? { runId: workflowRun.id } : {}),
    },
    operations: {
      patchSurveyV3: { path: { surveyId: CONTRACT_IDS.SURVEY_PATCH } },
      deleteSurveyV3: { path: { surveyId: CONTRACT_IDS.SURVEY_DELETE } },
      archiveSurveyV3: { path: { surveyId: CONTRACT_IDS.SURVEY_ARCHIVE } },
      restoreSurveyV3: { path: { surveyId: CONTRACT_IDS.SURVEY_RESTORE } },
      patchWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_PATCH } },
      deleteWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_DELETE } },
      duplicateWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_DUPLICATE } },
      enableWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_ENABLE } },
      disableWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_DISABLE } },
      archiveWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_ARCHIVE } },
      unarchiveWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_UNARCHIVE } },
    },
  };

  writeFileSync(outPath, `${JSON.stringify(fixtures, null, 2)}\n`);
  logger.info(`Seeded v3 contract fixtures and wrote the id map to ${outPath}.`);
}

main()
  .catch((error: unknown) => {
    logger.error(error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect().catch((error: unknown) => {
      logger.error(error, "Error disconnecting prisma");
    });
  });
