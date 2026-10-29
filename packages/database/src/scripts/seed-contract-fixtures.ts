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
  SURVEY_BLOCKS_EDIT: "clctsurveyblocksedit0001",
  SURVEY_BLOCKS_ORDER: "clctsurveyblocksorder001",
  SURVEY_DOCUMENT_PUSH: "clctsurveydocumentpush001",
  SURVEY_RESTORE: "clctsurveyrestore0000001",
  SURVEY_VISIBILITY: "clctsurveyvisibility0001",
  SURVEY_VISIBILITY_PRIVATE: "clctsurveyvisibilityp001",
  SURVEY_PAUSE_CREATIVES: "clctsurveypausecreatives",
  WORKFLOW_PATCH: "clctworkflowpatch0000001",
  WORKFLOW_DELETE: "clctworkflowdelete000001",
  WORKFLOW_DUPLICATE: "clctworkflowduplicate001",
  WORKFLOW_ENABLE: "clctworkflowenable000001",
  WORKFLOW_DISABLE: "clctworkflowdisable00001",
  WORKFLOW_ARCHIVE: "clctworkflowarchive00001",
  WORKFLOW_UNARCHIVE: "clctworkflowunarchive001",
  WORKFLOW_TEST: "clctworkflowtest00000001",
  ACTION_CLASS_READ: "clctactionclassread00001",
  RESPONSE_READ: "clctresponseread00000001",
  CREATIVE_READ: "clctcreativeread00000001",
  CREATIVE_PATCH: "clctcreativepatch0000001",
  CREATIVE_DELETE: "clctcreativedelete000001",
  CREATIVE_ARCHIVE: "clctcreativearchive00001",
  CREATIVE_RESTORE: "clctcreativerestore00001",
  CREATIVE_DUPLICATE: "clctcreativeduplicate001",
  CREATIVE_PAUSE: "clctcreativepause0000001",
  WORKSPACE_SETUP: "clctworkspacesetup000001",
} as const;

/**
 * Pinned `updatedAt` for every seeded survey, so the block operations' `expectedUpdatedAt` override can
 * name it. Their documented request examples carry a fixed timestamp, and the hook only rewrites keys the
 * overrides name — left alone, every example call answers 409 and neither operation's 200 is ever
 * schema-checked. Once a run's first edit lands the row moves on and later cases answer 409, which is
 * documented too.
 */
const CONTRACT_FIXTURE_UPDATED_AT = new Date("2026-04-21T10:00:00.000Z");

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
 *
 * `zh-Hans` and `zh-Hans-CN` are not both seeded: the survey document contract treats them as one
 * language (`duplicate_locale`), so a survey configuring both is a stored survey the v3 write path
 * refuses with 422 `stored_survey_invalid` — which is all `PUT /api/v3/surveys/{surveyId}/document`
 * ever answered against this fixture. The `lang=zh-Hans-CN` example still resolves, to `zh-Hans`.
 */
const READ_SURVEY_LANGUAGES = ["en-US", "de-DE", "pt-PT", "zh-Hans"] as const;

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

/**
 * One response on the read survey, so the three response reads have something to return.
 *
 * Without it `GET /api/v3/responses` and `/count` answer a valid but empty page, and
 * `GET /{responseId}` has no id to fetch — all schema-conformant, and none of it exercising the
 * payload the contract actually describes. The answer is keyed by the read survey's own element id
 * so it resolves into `answers[]` rather than landing in `unresolved[]`, which is the difference
 * between checking the envelope and checking the response body.
 *
 * `ttc` is present because `durationSeconds` is the one optional member of the payload, and absent
 * timing is the case that omits it — seeding timing exercises the other branch.
 *
 * The destructive response operations are not seeded here: their gates open on their own tickets,
 * and each will want its own victim for the reason this file's header gives.
 */
async function seedResponse(id: string, surveyId: string): Promise<void> {
  const elementId = `${surveyId}element`;
  const fields = {
    surveyId,
    finished: true,
    // The survey's own default code, not `"default"`. `"default"` is a legitimate stored value — the
    // contract says so (`ResponseBase.yml`) and three app surfaces guard on it — but it is the wrong
    // fixture here: it matches none of the survey's declared languages, so `resolveV3LabelContext`
    // took the unrecognised-language fallback and the one row the contract suite validates exercised
    // the fallback branch in every body. `z.string().nullable()` accepts that, so nothing failed — the
    // fixture was schema-valid and had quietly stopped describing the ordinary payload.
    language: READ_SURVEY_LANGUAGES[0],
    data: { [elementId]: "Contract fixture answer" },
    ttc: { [elementId]: 1500, _total: 1500 },
    meta: { source: "link" },
    variables: {},
  };

  await prisma.response.upsert({
    where: { id },
    update: fields,
    create: { id, ...fields },
  });
}

/**
 * Block and element ids the block-edit fixture is seeded with: the ones the documented request examples
 * of `PATCH /api/v3/surveys/{surveyId}/blocks` name. The alternative — a generic `id` override in the
 * hook — rewrites every `id` key in the example recursively, so the update's *element* id becomes the
 * block id (a cross-namespace `duplicate_identifier` 422) and the insert's new block id becomes an
 * existing one (another 422). Seeding the example's ids instead lets the update example answer 200
 * against a non-draft survey, whose element ids are immutable and therefore have to match too.
 */
const BLOCK_EDIT_EXAMPLE_BLOCKS = [
  { id: "k1p9wq2m4x7c3v8b5n6t0j2r", elementId: "satisfaction" },
  { id: "n7m4q8w2e6r0t3y5u1i9o2p4", elementId: "followup_seed" },
] as const;

async function seedSurvey(
  id: string,
  name: string,
  archived: boolean,
  // The block operations need at least two blocks: one to address and one left over, since removing
  // the last block is (correctly) rejected.
  blockCount = 1,
  blockIds?: readonly { id: string; elementId: string }[]
): Promise<void> {
  const blocks = Array.from({ length: blockCount }, (_unused, index) => ({
    id: blockIds?.[index]?.id ?? (index === 0 ? `${id}block` : `${id}block${String(index + 1)}`),
    name: `Main Block ${String(index + 1)}`,
    elements: [
      {
        id:
          blockIds?.[index]?.elementId ?? (index === 0 ? `${id}element` : `${id}element${String(index + 1)}`),
        type: "openText",
        headline: { default: "Contract fixture question" },
        required: false,
      },
    ],
  })) as unknown as TSurveyBlocks;

  const fields = {
    name,
    workspaceId: SEED_IDS.WORKSPACE,
    status: "inProgress" as const,
    type: "link" as const,
    blocks,
    archivedAt: archived ? new Date() : null,
    updatedAt: CONTRACT_FIXTURE_UPDATED_AT,
  };

  await prisma.survey.upsert({ where: { id }, update: fields, create: { id, ...fields } });
}

/**
 * Custom CSS on the read survey and the workspace (ENG-3641), so `GET /api/v3/surveys/{surveyId}` and
 * `GET /api/v3/workspaces/{workspaceId}/custom-css` return a populated `customCss` (and `previous`) rather
 * than `null`, and their schemas are validated against real values. Seeded under processor version 0 —
 * older than any real processor — so the workspace read also exercises the reprocess path behind
 * `status`. Synthetic CSS only; never a customer stylesheet.
 */
const CONTRACT_CUSTOM_CSS = {
  light: {
    source: '[data-fb-part="headline"] { font-weight: 600; }',
    compiled: '@layer fb-survey { #fbjs [data-fb-part="headline"] { font-weight: 600 !important; } }',
  },
  dark: {
    source: '#fbjs[data-appearance="dark"] { --acme-ink: #e6eef5; }',
    compiled: '@layer fb-survey-dark { #fbjs[data-appearance="dark"] { --acme-ink: #e6eef5 !important; } }',
  },
  processorVersion: 0,
};

async function seedCustomCss(readSurveyId: string): Promise<void> {
  await prisma.survey.update({
    where: { id: readSurveyId },
    data: { customCss: CONTRACT_CUSTOM_CSS, updatedAt: CONTRACT_FIXTURE_UPDATED_AT },
  });
  await prisma.workspace.update({
    where: { id: SEED_IDS.WORKSPACE },
    data: {
      customCss: {
        ...CONTRACT_CUSTOM_CSS,
        light: {
          source: CONTRACT_CUSTOM_CSS.light.source,
          compiled: CONTRACT_CUSTOM_CSS.light.compiled.replace("fb-survey", "fb-workspace"),
        },
        dark: null,
      },
      customCssPrevious: { light: null, dark: CONTRACT_CUSTOM_CSS.dark, processorVersion: 0 },
    },
  });
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

const NO_THEME_OVERRIDES = {
  customStyles: false,
  backgroundColor: null,
  textColor: null,
  borderColor: null,
  fontWeight: null,
  fontSize: { desktop: null, phone: null },
  paddingX: { desktop: null, phone: null },
  paddingY: { desktop: null, phone: null },
};

/**
 * One creative per mutating operation, for the reason this file's header gives (ENG-3993). The read
 * fixture is a published feedback button opening the read survey, with a second language, so the list and
 * the detail read validate a populated `destination` and `languages`; the others are the cheapest shape
 * their operation answers 200 for. Content and styling are the stored JSON, which is the API's own shape.
 */
async function seedCreative(
  id: string,
  {
    name,
    type,
    status,
    archived = false,
    surveyId = null,
    linkUrl = null,
  }: {
    name: string;
    type: "feedbackButton" | "banner";
    status: "draft" | "inProgress";
    archived?: boolean;
    surveyId?: string | null;
    linkUrl?: string | null;
  }
): Promise<void> {
  const fields =
    type === "feedbackButton"
      ? {
          content: { label: { "en-US": "Feedback", "de-DE": "Feedback geben" }, icon: "messageSquare" },
          styling: {
            position: { desktop: { edge: "right", offset: 50 }, phone: null },
            theme: { ...NO_THEME_OVERRIDES, borderRadius: null },
          },
        }
      : {
          content: {
            message: {
              "en-US": [{ text: "Contract fixture notice. " }, { text: "Details", href: "/details" }],
            },
            button: null,
            dismissible: true,
            accessibleName: null,
          },
          styling: {
            position: { desktop: { placement: "top", layout: "inPage" }, phone: null },
            theme: NO_THEME_OVERRIDES,
          },
        };
  const data = {
    name,
    type,
    status,
    publishedAt: status === "draft" ? null : CONTRACT_FIXTURE_UPDATED_AT,
    archivedAt: archived ? CONTRACT_FIXTURE_UPDATED_AT : null,
    workspaceId: SEED_IDS.WORKSPACE,
    surveyId,
    linkUrl,
    ...fields,
  };
  await prisma.creative.upsert({ where: { id }, update: data, create: { id, ...data } });

  const languages = await prisma.language.findMany({
    where: { workspaceId: SEED_IDS.WORKSPACE, code: { in: ["en-US", "de-DE"] } },
    select: { id: true, code: true },
  });
  for (const language of languages) {
    if (type === "banner" && language.code !== "en-US") continue;
    const isDefault = language.code === "en-US";
    await prisma.creativeLanguage.upsert({
      where: { languageId_creativeId: { languageId: language.id, creativeId: id } },
      update: { default: isDefault, enabled: true },
      create: { languageId: language.id, creativeId: id, default: isDefault, enabled: true },
    });
  }
}

async function main(): Promise<void> {
  const outPath = getOutPath();

  const workspace = await prisma.workspace.findUnique({ where: { id: SEED_IDS.WORKSPACE } });
  if (!workspace) {
    throw new Error(`Workspace ${SEED_IDS.WORKSPACE} is missing — run \`db:seed\` before this script.`);
  }

  await seedSurvey(CONTRACT_IDS.SURVEY_READ, "Contract fixture — read", false);
  await seedSurveyLanguages(CONTRACT_IDS.SURVEY_READ, READ_SURVEY_LANGUAGES);
  await seedResponse(CONTRACT_IDS.RESPONSE_READ, CONTRACT_IDS.SURVEY_READ);
  await seedCustomCss(CONTRACT_IDS.SURVEY_READ);
  await seedSurvey(CONTRACT_IDS.SURVEY_PATCH, "Contract fixture — patch", false);
  await seedSurvey(CONTRACT_IDS.SURVEY_DELETE, "Contract fixture — delete", false);
  await seedSurvey(CONTRACT_IDS.SURVEY_ARCHIVE, "Contract fixture — archive", false);
  await seedSurvey(
    CONTRACT_IDS.SURVEY_BLOCKS_EDIT,
    "Contract fixture — block edit",
    false,
    BLOCK_EDIT_EXAMPLE_BLOCKS.length,
    BLOCK_EDIT_EXAMPLE_BLOCKS
  );
  await seedSurvey(CONTRACT_IDS.SURVEY_BLOCKS_ORDER, "Contract fixture — block order", false, 2);
  // The document push examples replace the survey with the one block of BLOCK_EDIT_EXAMPLE_BLOCKS. The
  // read survey has a response on a different block, so there the push is a documented 409
  // `destructive_change` every time; a survey with no responses and the example's block takes it.
  await seedSurvey(
    CONTRACT_IDS.SURVEY_DOCUMENT_PUSH,
    "Contract fixture — document push",
    false,
    1,
    BLOCK_EDIT_EXAMPLE_BLOCKS
  );
  // Restore only has something to do on an already-archived survey.
  await seedSurvey(CONTRACT_IDS.SURVEY_RESTORE, "Contract fixture — restore", true);
  // ENG-3282: one workspace-visible and one restricted survey, both owned by the seed admin, so the
  // visibility operations and the list's visibility fields have real rows in both states.
  await seedSurvey(CONTRACT_IDS.SURVEY_VISIBILITY, "Contract fixture — visibility", false);
  await seedSurvey(CONTRACT_IDS.SURVEY_VISIBILITY_PRIVATE, "Contract fixture — restricted", false);
  await Promise.all(
    (
      [
        [CONTRACT_IDS.SURVEY_VISIBILITY, "workspace"],
        [CONTRACT_IDS.SURVEY_VISIBILITY_PRIVATE, "restricted"],
      ] as const
    ).map(([id, visibility]) =>
      prisma.survey.update({
        where: { id },
        data: { ownerId: SEED_IDS.USER_ADMIN, visibility, updatedAt: CONTRACT_FIXTURE_UPDATED_AT },
      })
    )
  );

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

  // After the read survey's languages, which seed the workspace's en-US and de-DE. The read creative opens
  // the read survey, which `read.surveyId` also points the list's `surveyId` filter at.
  await seedCreative(CONTRACT_IDS.CREATIVE_READ, {
    name: "Contract fixture — read",
    type: "feedbackButton",
    status: "inProgress",
    surveyId: CONTRACT_IDS.SURVEY_READ,
  });
  // Counts for today (UTC), inside the stats operation's default range, so its response carries days,
  // pages and devices with numbers rather than only zeros.
  const today = new Date(new Date().toISOString().slice(0, 10));
  await prisma.creativeDailyStat.upsert({
    where: {
      creativeId_date_deviceType: {
        creativeId: CONTRACT_IDS.CREATIVE_READ,
        date: today,
        deviceType: "phone",
      },
    },
    update: {},
    create: {
      creativeId: CONTRACT_IDS.CREATIVE_READ,
      date: today,
      deviceType: "phone",
      impressions: 40,
      clicks: 2,
    },
  });
  await prisma.creativeDailyPageStat.upsert({
    where: {
      creativeId_date_page: {
        creativeId: CONTRACT_IDS.CREATIVE_READ,
        date: today,
        page: "example.com/pricing",
      },
    },
    update: {},
    create: {
      creativeId: CONTRACT_IDS.CREATIVE_READ,
      date: today,
      page: "example.com/pricing",
      impressions: 40,
      clicks: 2,
    },
  });
  // A notice-only banner: the patch examples (pause, reschedule) answer 200 without a Destination.
  await seedCreative(CONTRACT_IDS.CREATIVE_PATCH, {
    name: "Contract fixture — patch",
    type: "banner",
    status: "draft",
  });
  await seedCreative(CONTRACT_IDS.CREATIVE_DELETE, {
    name: "Contract fixture — delete",
    type: "feedbackButton",
    status: "draft",
    linkUrl: "https://example.com/feedback",
  });
  await seedCreative(CONTRACT_IDS.CREATIVE_ARCHIVE, {
    name: "Contract fixture — archive",
    type: "feedbackButton",
    status: "inProgress",
    linkUrl: "https://example.com/feedback",
  });
  // Restore only has something to do on an archived creative.
  await seedCreative(CONTRACT_IDS.CREATIVE_RESTORE, {
    name: "Contract fixture — restore",
    type: "feedbackButton",
    status: "inProgress",
    archived: true,
    linkUrl: "https://example.com/feedback",
  });
  await seedCreative(CONTRACT_IDS.CREATIVE_DUPLICATE, {
    name: "Contract fixture — duplicate",
    type: "banner",
    status: "inProgress",
  });
  // A survey of its own for `POST /api/v3/creatives/pause`, so pausing it never touches the read creative.
  await seedSurvey(CONTRACT_IDS.SURVEY_PAUSE_CREATIVES, "Contract fixture — pause creatives", false);
  await seedCreative(CONTRACT_IDS.CREATIVE_PAUSE, {
    name: "Contract fixture — pause",
    type: "feedbackButton",
    status: "inProgress",
    surveyId: CONTRACT_IDS.SURVEY_PAUSE_CREATIVES,
  });

  // `PATCH /api/v3/workspaces/{workspaceId}` and `PUT .../branding` accept an API key with `manage`, so the
  // harness key really writes through them. They get a workspace of their own, with the grant the seed key
  // gets on the main one, rather than renaming and restyling the workspace every other operation reads.
  // Without `SEED_API_KEY` there is no key and no grant, and both answer their documented 403.
  await prisma.workspace.upsert({
    where: { id: CONTRACT_IDS.WORKSPACE_SETUP },
    update: { name: "Contract fixture — workspace setup" },
    create: {
      id: CONTRACT_IDS.WORKSPACE_SETUP,
      name: "Contract fixture — workspace setup",
      organizationId: workspace.organizationId,
    },
  });
  const seedApiKey = await prisma.apiKey.findUnique({
    where: { id: SEED_IDS.API_KEY },
    select: { id: true },
  });
  if (seedApiKey) {
    await prisma.apiKeyWorkspace.upsert({
      where: {
        apiKeyId_workspaceId: { apiKeyId: seedApiKey.id, workspaceId: CONTRACT_IDS.WORKSPACE_SETUP },
      },
      update: { permission: "manage" },
      create: { apiKeyId: seedApiKey.id, workspaceId: CONTRACT_IDS.WORKSPACE_SETUP, permission: "manage" },
    });
  }

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
      creativeId: CONTRACT_IDS.CREATIVE_READ,
      ...(workflowRun ? { runId: workflowRun.id } : {}),
    },
    operations: {
      getResponseV3: { path: { responseId: CONTRACT_IDS.RESPONSE_READ } },
      patchSurveyV3: { path: { surveyId: CONTRACT_IDS.SURVEY_PATCH } },
      deleteSurveyV3: { path: { surveyId: CONTRACT_IDS.SURVEY_DELETE } },
      archiveSurveyV3: { path: { surveyId: CONTRACT_IDS.SURVEY_ARCHIVE } },
      // No `id`/`blockId` override on purpose — the survey is seeded with the example's own ids (see
      // BLOCK_EDIT_EXAMPLE_BLOCKS), because the hook rewrites `id` at every depth and would turn the
      // example's element id into the block id.
      editSurveyBlocksV3: {
        path: { surveyId: CONTRACT_IDS.SURVEY_BLOCKS_EDIT },
        body: {
          expectedUpdatedAt: CONTRACT_FIXTURE_UPDATED_AT.toISOString(),
        },
      },
      // The order must be a permutation of the seeded survey's own block ids, so it cannot be
      // generated — without this the operation only ever exercises its documented 422. And without the
      // pinned `expectedUpdatedAt`, the example's fixed timestamp makes every call a 409.
      setSurveyBlockOrderV3: {
        path: { surveyId: CONTRACT_IDS.SURVEY_BLOCKS_ORDER },
        body: {
          order: [`${CONTRACT_IDS.SURVEY_BLOCKS_ORDER}block`, `${CONTRACT_IDS.SURVEY_BLOCKS_ORDER}block2`],
          expectedUpdatedAt: CONTRACT_FIXTURE_UPDATED_AT.toISOString(),
        },
      },
      // Pinned like the block operations: the push examples carry a fixed `expectedUpdatedAt`.
      pushSurveyDocumentV3: {
        path: { surveyId: CONTRACT_IDS.SURVEY_DOCUMENT_PUSH },
        body: { expectedUpdatedAt: CONTRACT_FIXTURE_UPDATED_AT.toISOString() },
      },
      restoreSurveyV3: { path: { surveyId: CONTRACT_IDS.SURVEY_RESTORE } },
      // API keys never manage visibility (K-4), and this harness authenticates with one, so both
      // operations are checked against their documented 403 — on a real, readable survey, not an
      // unknown id, which is the same body by design.
      getSurveyVisibilityV3: { path: { surveyId: CONTRACT_IDS.SURVEY_VISIBILITY } },
      changeSurveyVisibilityV3: { path: { surveyId: CONTRACT_IDS.SURVEY_VISIBILITY } },
      patchWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_PATCH } },
      deleteWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_DELETE } },
      duplicateWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_DUPLICATE } },
      enableWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_ENABLE } },
      disableWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_DISABLE } },
      archiveWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_ARCHIVE } },
      unarchiveWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_UNARCHIVE } },
      testWorkflowV3: { path: { workflowId: CONTRACT_IDS.WORKFLOW_TEST } },
      patchCreativeV3: { path: { creativeId: CONTRACT_IDS.CREATIVE_PATCH } },
      deleteCreativeV3: { path: { creativeId: CONTRACT_IDS.CREATIVE_DELETE } },
      archiveCreativeV3: { path: { creativeId: CONTRACT_IDS.CREATIVE_ARCHIVE } },
      restoreCreativeV3: { path: { creativeId: CONTRACT_IDS.CREATIVE_RESTORE } },
      duplicateCreativeV3: { path: { creativeId: CONTRACT_IDS.CREATIVE_DUPLICATE } },
      pauseCreativesV3: { body: { surveyId: CONTRACT_IDS.SURVEY_PAUSE_CREATIVES } },
      // The documented example names a survey that exists in no database, which is the 422
      // `dangling_reference` by design; point it at the readable fixture so the create is exercised.
      createWebhookV3: { body: { surveyIds: [CONTRACT_IDS.SURVEY_READ] } },
      // Their own workspace, so the rename and the brand colour do not land on the one the rest reads.
      updateWorkspaceV3: { path: { workspaceId: CONTRACT_IDS.WORKSPACE_SETUP } },
      setWorkspaceBrandingV3: { path: { workspaceId: CONTRACT_IDS.WORKSPACE_SETUP } },
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
