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
import { SEED_CREDENTIALS, SEED_IDS } from "../seed/constants";

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
  WORKFLOW_TEST: "clctworkflowtest00000001",
  ACTION_CLASS_READ: "clctactionclassread00001",
  // Feedback datasets are `FeedbackDirectory` rows; the id is what the API calls `datasetId` and what
  // the feedback store calls its tenant. Two of them on purpose — see `seedFeedbackDatasets`.
  FEEDBACK_DATASET: "clctfeedbackdataset00001",
  FEEDBACK_DATASET_FOREIGN: "clctfeedbackforeign00001",
  FOREIGN_ORGANIZATION: "clctfeedbackforeignorg01",
  FOREIGN_WORKSPACE: "clctfeedbackforeignws001",
} as const;

/**
 * The seeded records, by the `submission_id` they are stored under. Fixed so re-seeding finds the
 * existing rows instead of duplicating them.
 *
 * `READ` carries text chosen to match the semantic-search example in the contract
 * (`query: complaints about waiting times at the gates`). That is not decoration: the search
 * operations only return a populated page when something actually scores above the threshold, and an
 * empty page satisfies the response schema while validating none of the match shape. With the
 * offline embedding stub this text scores ~0.76 against that query — above both the app's 0.5
 * default and the store's own 0.7 — so the operation is exercised with a real match either way.
 */
const FEEDBACK_SUBMISSIONS = {
  READ: "contract-feedback-read",
  PATCH: "contract-feedback-patch",
  DELETE: "contract-feedback-delete",
} as const;

const FEEDBACK_RECORD_TEXT: Record<string, string> = {
  [FEEDBACK_SUBMISSIONS.READ]:
    "Complaints about waiting times at the gates - we queued 40 minutes to get in.",
  [FEEDBACK_SUBMISSIONS.PATCH]: "Contract fixture for the update operation.",
  [FEEDBACK_SUBMISSIONS.DELETE]: "Contract fixture for the delete operation.",
};

/**
 * Where the id map goes. Defaults to the contract-tests directory that reads it, resolved from this
 * file rather than the working directory — `pnpm --filter` runs scripts from the package root, so a
 * caller-supplied relative path would mean something different from what the caller typed.
 */
function getOutPath(): string {
  const index = process.argv.indexOf("--out");
  const override = index === -1 ? undefined : process.argv[index + 1];

  // A trailing `--out` with no value is otherwise indistinguishable from no `--out` at all: the map
  // would be written to the default path — the very file the caller was redirecting away from — with no
  // diagnostic. Easy to hit with `--out "$SOME_UNSET_VAR"`, so fail loudly instead.
  if (index !== -1 && !override) {
    throw new Error("--out requires a path argument.");
  }

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
          // Must be a workspace MEMBER, not an arbitrary address: `enable` and `testWorkflow` run the
          // ENG-2029 recipient allowlist (`verifyRecipientsAllowed` → `getWorkspaceMemberEmails`), so a
          // non-member recipient makes enable answer 422 `workflow_not_executable` and testWorkflow
          // answer `{ok:false, recipient_not_allowed}`. Both are documented, so the suite would stay
          // green while never schema-checking the success bodies these fixtures exist for. The admin is
          // the organization owner, so it passes.
          to: SEED_CREDENTIALS.ADMIN.email,
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

/**
 * Two feedback datasets, because one cannot detect a cross-tenant read.
 *
 * `FEEDBACK_DATASET` is assigned to the seeded workspace, so the seeded key reaches it. **Exactly
 * one** assignment: a dataset shared by two workspaces has no workspace whose permission can say
 * whose records they are, so the surface refuses update and delete on it (ENG-2189) — a second
 * assignment would silently turn two documented 200s into 403s and the contract run would still be
 * green.
 *
 * `FEEDBACK_DATASET_FOREIGN` belongs to a different organization and a workspace the key has no
 * permission on. Nothing in the contract run touches it: Schemathesis checks the documented contract,
 * not tenancy, and it only ever sends the one workspace it is told about. It exists for
 * `tenancy-check.sh`, which asserts that a foreign dataset and a nonexistent one are indistinguishable
 * from outside — the property a contract test cannot see.
 */
async function seedFeedbackDatasets(): Promise<void> {
  await prisma.feedbackDirectory.upsert({
    where: { id: CONTRACT_IDS.FEEDBACK_DATASET },
    update: {},
    create: {
      id: CONTRACT_IDS.FEEDBACK_DATASET,
      name: "Contract fixture — feedback dataset",
      organizationId: SEED_IDS.ORGANIZATION,
    },
  });
  await prisma.feedbackDirectoryWorkspace.upsert({
    where: {
      feedbackDirectoryId_workspaceId: {
        feedbackDirectoryId: CONTRACT_IDS.FEEDBACK_DATASET,
        workspaceId: SEED_IDS.WORKSPACE,
      },
    },
    update: {},
    create: { feedbackDirectoryId: CONTRACT_IDS.FEEDBACK_DATASET, workspaceId: SEED_IDS.WORKSPACE },
  });

  // A separate organization, so the refusal is exercised at both layers the policy checks: the key
  // does not belong to this organization, and holds no permission on its workspace.
  await prisma.organization.upsert({
    where: { id: CONTRACT_IDS.FOREIGN_ORGANIZATION },
    update: {},
    create: { id: CONTRACT_IDS.FOREIGN_ORGANIZATION, name: "Contract fixture — foreign organization" },
  });
  await prisma.workspace.upsert({
    where: { id: CONTRACT_IDS.FOREIGN_WORKSPACE },
    update: {},
    create: {
      id: CONTRACT_IDS.FOREIGN_WORKSPACE,
      name: "Contract fixture — foreign workspace",
      organizationId: CONTRACT_IDS.FOREIGN_ORGANIZATION,
    },
  });
  await prisma.feedbackDirectory.upsert({
    where: { id: CONTRACT_IDS.FEEDBACK_DATASET_FOREIGN },
    update: {},
    create: {
      id: CONTRACT_IDS.FEEDBACK_DATASET_FOREIGN,
      name: "Contract fixture — foreign feedback dataset",
      organizationId: CONTRACT_IDS.FOREIGN_ORGANIZATION,
    },
  });
  await prisma.feedbackDirectoryWorkspace.upsert({
    where: {
      feedbackDirectoryId_workspaceId: {
        feedbackDirectoryId: CONTRACT_IDS.FEEDBACK_DATASET_FOREIGN,
        workspaceId: CONTRACT_IDS.FOREIGN_WORKSPACE,
      },
    },
    update: {},
    create: {
      feedbackDirectoryId: CONTRACT_IDS.FEEDBACK_DATASET_FOREIGN,
      workspaceId: CONTRACT_IDS.FOREIGN_WORKSPACE,
    },
  });
}

/**
 * Feedback records live in the feedback store, not in this database, so they are seeded over its API
 * rather than with Prisma. Returns the record id per fixed `submission_id`.
 *
 * Skipped, with a warning rather than a throw, when the store is not configured: `db:seed:contract`
 * is also run by developers whose stack has no store, and the four feedback operations that need a
 * record then answer their documented 403 — shallower, but honest, and the same degradation the
 * entitlement-gated operations already have.
 *
 * Records are unique per (tenant, submission, field), so a re-seed answers 409. That is the expected
 * path on a second run, not a failure: the existing record is looked up and reused, which is what
 * keeps the id map stable across runs.
 */
async function seedFeedbackRecords(): Promise<Record<string, string>> {
  const baseUrl = process.env.HUB_API_URL?.replace(/\/+$/, "");
  const apiKey = process.env.HUB_API_KEY;
  if (!baseUrl || !apiKey) {
    logger.warn(
      "HUB_API_URL/HUB_API_KEY unset — skipping feedback record fixtures. The four operations that need a record will answer their documented 403."
    );
    return {};
  }

  const headers = { authorization: `Bearer ${apiKey}`, "content-type": "application/json" };
  const ids: Record<string, string> = {};

  for (const submissionId of Object.values(FEEDBACK_SUBMISSIONS)) {
    const body = {
      tenant_id: CONTRACT_IDS.FEEDBACK_DATASET,
      source_type: "review",
      source_name: "Contract fixtures",
      submission_id: submissionId,
      field_id: "review_body",
      field_type: "text",
      value_text: FEEDBACK_RECORD_TEXT[submissionId],
      language: "en",
    };

    const created = await fetch(`${baseUrl}/v1/feedback-records`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (created.ok) {
      const record = (await created.json()) as { id?: string };
      if (record.id) ids[submissionId] = record.id;
      continue;
    }

    if (created.status !== 409) {
      throw new Error(
        `Seeding feedback record ${submissionId} failed with ${created.status}. The feedback contract operations would run against no data.`
      );
    }

    // Already present from an earlier run — find it rather than inventing a new submission id, so the
    // id map stays stable and the store does not accumulate a record per CI run.
    const query = new URLSearchParams({
      tenant_id: CONTRACT_IDS.FEEDBACK_DATASET,
      submission_id: submissionId,
      limit: "1",
    });
    const existing = await fetch(`${baseUrl}/v1/feedback-records?${query.toString()}`, { headers });
    if (!existing.ok) {
      throw new Error(`Feedback record ${submissionId} exists but could not be read (${existing.status}).`);
    }
    const page = (await existing.json()) as { data?: { id?: string }[] };
    const found = page.data?.[0]?.id;
    if (!found) {
      throw new Error(`Feedback record ${submissionId} answered 409 but no matching record was found.`);
    }
    ids[submissionId] = found;
  }

  logger.info(`Seeded ${Object.keys(ids).length} feedback record fixtures.`);
  return ids;
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
  // `test` is a dry run, but it resolves the trigger and the recipient allowlist for real, so it needs
  // a definition whose recipient is a workspace member — which the base seed's demo workflows are not.
  await seedWorkflow(CONTRACT_IDS.WORKFLOW_TEST, "Contract fixture — test", "draft");

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

  await seedFeedbackDatasets();
  const feedbackRecordIds = await seedFeedbackRecords();

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
      // Every feedback operation takes `datasetId`; the ones that address a single record also take
      // `feedbackRecordId`, defaulted here to the read fixture and overridden per operation below.
      datasetId: CONTRACT_IDS.FEEDBACK_DATASET,
      ...(feedbackRecordIds[FEEDBACK_SUBMISSIONS.READ]
        ? { feedbackRecordId: feedbackRecordIds[FEEDBACK_SUBMISSIONS.READ] }
        : {}),
    },
    // Not consumed by the Schemathesis hooks — a contract run must never send these, or it would be
    // asserting a 403 against the documented 200. Written for `tenancy-check.sh`.
    tenancy: {
      foreignDatasetId: CONTRACT_IDS.FEEDBACK_DATASET_FOREIGN,
      foreignWorkspaceId: CONTRACT_IDS.FOREIGN_WORKSPACE,
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
      testWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_TEST } },
      // Their own victims, so a delete cannot decide what the read fixture sees.
      ...(feedbackRecordIds[FEEDBACK_SUBMISSIONS.PATCH]
        ? {
            updateFeedbackRecordV3: {
              path: { feedbackRecordId: feedbackRecordIds[FEEDBACK_SUBMISSIONS.PATCH] },
            },
          }
        : {}),
      ...(feedbackRecordIds[FEEDBACK_SUBMISSIONS.DELETE]
        ? {
            deleteFeedbackRecordV3: {
              path: { feedbackRecordId: feedbackRecordIds[FEEDBACK_SUBMISSIONS.DELETE] },
            },
          }
        : {}),
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
