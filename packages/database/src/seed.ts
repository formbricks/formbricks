import { createId } from "@paralleldrive/cuid2";
import bcryptjs from "bcryptjs";
import { logger } from "@formbricks/logger";
import { type TSurveyBlocks } from "@formbricks/types/surveys/blocks";
import type {
  TWorkflowDefinition,
  TWorkflowRunData,
  TWorkflowTriggerRunPayload,
} from "@formbricks/workflows";
import { type Prisma, PrismaClient } from "./prisma";
import { createPrismaPgAdapter } from "./prisma-adapter";
import { SEED_CREDENTIALS, SEED_IDS } from "./seed/constants";

const hashPassword = bcryptjs.hash;

const prisma = new PrismaClient({ adapter: createPrismaPgAdapter().adapter });

const isProduction = process.env.NODE_ENV === "production";
const allowSeed = process.env.ALLOW_SEED === "true";

if (isProduction && !allowSeed) {
  logger.error("ERROR: Seeding blocked in production. Set ALLOW_SEED=true to override.");
  process.exit(1);
}

const clearData = process.argv.includes("--clear");

// Define local types to avoid resolution issues in seed script
type SurveyElementType =
  | "openText"
  | "multipleChoiceSingle"
  | "multipleChoiceMulti"
  | "nps"
  | "cta"
  | "rating"
  | "consent"
  | "date"
  | "matrix"
  | "address"
  | "ranking"
  | "contactInfo";

interface SurveyQuestion {
  id: string;
  type: SurveyElementType;
  headline: { default: string; [key: string]: string };
  subheader?: { default: string; [key: string]: string };
  required?: boolean;
  placeholder?: { default: string; [key: string]: string };
  longAnswer?: boolean;
  choices?: { id: string; label: { default: string }; imageUrl?: string }[];
  lowerLabel?: { default: string };
  upperLabel?: { default: string };
  buttonLabel?: { default: string };
  buttonUrl?: string;
  buttonExternal?: boolean;
  dismissButtonLabel?: { default: string };
  ctaButtonLabel?: { default: string };
  scale?: string;
  range?: number;
  label?: { default: string };
  allowMulti?: boolean;
  format?: string;
  rows?: { id: string; label: { default: string } }[];
  columns?: { id: string; label: { default: string } }[];
  addressLine1?: { show: boolean; required: boolean; placeholder: { default: string } };
  addressLine2?: { show: boolean; required: boolean; placeholder: { default: string } };
  city?: { show: boolean; required: boolean; placeholder: { default: string } };
  state?: { show: boolean; required: boolean; placeholder: { default: string } };
  zip?: { show: boolean; required: boolean; placeholder: { default: string } };
  country?: { show: boolean; required: boolean; placeholder: { default: string } };
  firstName?: { show: boolean; required: boolean; placeholder: { default: string } };
  lastName?: { show: boolean; required: boolean; placeholder: { default: string } };
  email?: { show: boolean; required: boolean; placeholder: { default: string } };
  phone?: { show: boolean; required: boolean; placeholder: { default: string } };
  company?: { show: boolean; required: boolean; placeholder: { default: string } };
  allowMultipleFiles?: boolean;
  maxSizeInMB?: number;
}

interface WorkflowSeedSpec {
  id: string;
  /// Short lowercase-alphanumeric key used to derive stable run/log ids (must satisfy z.cuid2()).
  runKey: string;
  name: string;
  description: string;
  status: "draft" | "enabled" | "disabled";
  triggerId: string;
  actionId: string;
  edgeId: string;
  endingCardIds?: string[];
  email: { to: string; subject: string; body: string };
}

type SeedRunStatus = "queued" | "running" | "completed" | "failed" | "canceled";
type SeedLogStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

interface WorkflowRunSeedSpec {
  /// Appended to the workflow runKey to build deterministic run/log ids; lowercase-alphanumeric.
  suffix: string;
  status: SeedRunStatus;
  /// How long before "now" the run was enqueued, so the list shows a realistic timeline.
  minutesAgo: number;
  started: boolean;
  finished: boolean;
  durationMs?: number;
  attempt?: number;
  error?: string;
  /// The single send_email step trace. null mirrors a queued run that never executed a step.
  log: { status: SeedLogStatus; error?: string } | null;
}

const WORKFLOW_RUN_SEEDS: Record<string, WorkflowRunSeedSpec[]> = {
  [SEED_IDS.WORKFLOW_RESPONSE_FOLLOW_UP]: [
    {
      suffix: "01",
      status: "completed",
      minutesAgo: 4,
      started: true,
      finished: true,
      durationMs: 820,
      log: { status: "succeeded" },
    },
    {
      suffix: "02",
      status: "completed",
      minutesAgo: 47,
      started: true,
      finished: true,
      durationMs: 610,
      log: { status: "succeeded" },
    },
    {
      suffix: "03",
      status: "running",
      minutesAgo: 1,
      started: true,
      finished: false,
      log: { status: "running" },
    },
    {
      suffix: "04",
      status: "failed",
      minutesAgo: 133,
      started: true,
      finished: true,
      durationMs: 1480,
      attempt: 2,
      error: "SMTP connection timed out",
      log: { status: "failed", error: "SMTP connection timed out" },
    },
    { suffix: "05", status: "queued", minutesAgo: 0, started: false, finished: false, log: null },
    {
      suffix: "06",
      status: "canceled",
      minutesAgo: 221,
      started: true,
      finished: true,
      durationMs: 240,
      log: { status: "skipped" },
    },
  ],
  [SEED_IDS.WORKFLOW_TEAM_NOTIFICATION]: [
    {
      suffix: "01",
      status: "completed",
      minutesAgo: 1440,
      started: true,
      finished: true,
      durationMs: 540,
      log: { status: "succeeded" },
    },
    {
      suffix: "02",
      status: "failed",
      minutesAgo: 1505,
      started: true,
      finished: true,
      durationMs: 910,
      attempt: 1,
      error: "Recipient mailbox full",
      log: { status: "failed", error: "Recipient mailbox full" },
    },
  ],
};

async function seedDemoWorkflows(workspaceId: string, surveyId: string): Promise<void> {
  logger.info("Seeding demo workflows...");

  const specs: WorkflowSeedSpec[] = [
    {
      id: SEED_IDS.WORKFLOW_RESPONSE_FOLLOW_UP,
      runKey: "fup",
      name: "Response follow-up",
      description: "Email respondents after they complete the survey.",
      status: "enabled",
      triggerId: "trigresponsefollowupseed",
      actionId: "actresponsefollowupseed1",
      edgeId: "edgresponsefollowupseed1",
      email: {
        to: "respondent@example.com",
        subject: "Thanks for your answers!",
        body: "Hi there, thanks for completing the survey.",
      },
    },
    {
      id: SEED_IDS.WORKFLOW_ENDING_CARD_FOLLOW_UP,
      runKey: "ending",
      name: "Ending card follow-up",
      description: "Notify the team when a specific ending card is reached.",
      status: "draft",
      triggerId: "trigendingfollowupseed01",
      actionId: "actendingfollowupseed001",
      edgeId: "edgendcardfollowupseed01",
      email: {
        to: "team@example.com",
        subject: "Respondent reached a key ending",
        body: "A respondent reached a tracked ending card.",
      },
    },
    {
      id: SEED_IDS.WORKFLOW_TEAM_NOTIFICATION,
      runKey: "team",
      name: "Team notification",
      description: "Send an internal notification for every completed response.",
      status: "disabled",
      triggerId: "trigteamnotificationseed",
      actionId: "actteamnotificationseed1",
      edgeId: "edgteamnotificationseed1",
      email: {
        to: "team@example.com",
        subject: "New survey response received",
        body: "A new response was completed. Check Formbricks for details.",
      },
    },
  ];

  for (const spec of specs) {
    const definition: TWorkflowDefinition = {
      schemaVersion: 1,
      entryNodeId: spec.triggerId,
      trigger: {
        id: spec.triggerId,
        type: "trigger",
        triggerType: "response.completed",
        config: { surveyId, endingCardIds: spec.endingCardIds ?? [] },
        ui: { position: { x: 220, y: 80 } },
      },
      nodes: [
        {
          id: spec.actionId,
          type: "action",
          actionType: "send_email",
          label: "Send email",
          config: {
            to: spec.email.to,
            from: "team@example.com",
            replyTo: [],
            subject: spec.email.subject,
            body: spec.email.body,
            attachResponseData: false,
          },
          ui: { position: { x: 220, y: 200 } },
        },
      ],
      edges: [{ id: spec.edgeId, source: spec.triggerId, target: spec.actionId }],
    };

    await prisma.workflow.upsert({
      where: { id: spec.id },
      update: {
        name: spec.name,
        description: spec.description,
        status: spec.status,
        definition,
      },
      create: {
        id: spec.id,
        workspaceId,
        name: spec.name,
        description: spec.description,
        status: spec.status,
        definition,
      },
    });
  }

  await seedDemoWorkflowRuns(workspaceId, surveyId, specs);
}

/**
 * Seed historical runs (and their per-step logs) for the demo workflows so the runs list and the
 * run-detail drawer have data to show. Runs are linked to real seeded responses so the trigger
 * payload's `responseId` is a valid cuid, matching what the v3 run API validates on read.
 */
async function seedDemoWorkflowRuns(
  workspaceId: string,
  surveyId: string,
  specs: WorkflowSeedSpec[]
): Promise<void> {
  logger.info("Seeding demo workflow runs...");

  const responses = await prisma.response.findMany({
    where: { surveyId },
    select: { id: true },
    orderBy: { createdAt: "desc" },
    take: 16,
  });

  if (responses.length === 0) {
    logger.warn(`No responses found for survey ${surveyId}; skipping workflow run seeding.`);
    return;
  }

  const now = Date.now();
  let responseCursor = 0;

  for (const spec of specs) {
    const runSeeds = WORKFLOW_RUN_SEEDS[spec.id] ?? [];

    for (const runSeed of runSeeds) {
      const responseId = responses[responseCursor % responses.length].id;
      responseCursor += 1;

      const runId = `clseedwfrun${spec.runKey}${runSeed.suffix}`;
      const logId = `clseedwfrunlog${spec.runKey}${runSeed.suffix}`;

      const createdAt = new Date(now - runSeed.minutesAgo * 60_000);
      const startedAt = runSeed.started ? new Date(createdAt.getTime() + 2_000) : null;
      const finishedAt =
        runSeed.finished && startedAt ? new Date(startedAt.getTime() + (runSeed.durationMs ?? 500)) : null;

      const triggerPayload: TWorkflowTriggerRunPayload = {
        type: "response.completed",
        workspaceId,
        surveyId,
        responseId,
        triggeredAt: createdAt.toISOString(),
      };

      const stepInput = { to: spec.email.to, subject: spec.email.subject };
      const stepOutput =
        runSeed.log?.status === "succeeded"
          ? { provider: "smtp", messageId: `seed-${runId}`, accepted: [spec.email.to] }
          : {};

      const steps: TWorkflowRunData["steps"] = runSeed.log
        ? [
            {
              stepId: spec.actionId,
              stepType: "send_email",
              status: runSeed.log.status,
              input: stepInput,
              output: stepOutput,
              ...(runSeed.log.error ? { error: runSeed.log.error } : {}),
              ...(startedAt ? { startedAt: startedAt.toISOString() } : {}),
              ...(finishedAt ? { finishedAt: finishedAt.toISOString() } : {}),
            },
          ]
        : [];

      const data: TWorkflowRunData = { trigger: triggerPayload, steps };

      const runFields = {
        workflowId: spec.id,
        workspaceId,
        workflowVersionId: null,
        responseId,
        status: runSeed.status,
        triggerType: "response.completed",
        surveyId,
        isDryRun: false,
        idempotencyKey: null,
        attempt: runSeed.attempt ?? 0,
        nextAttemptAt: null,
        lastErrorAt: runSeed.error ? finishedAt : null,
        triggerPayload,
        data,
        error: runSeed.error ?? null,
        createdAt,
        updatedAt: finishedAt ?? startedAt ?? createdAt,
        startedAt,
        finishedAt,
      };

      await prisma.workflowRun.upsert({
        where: { id: runId },
        update: runFields,
        create: { id: runId, ...runFields },
      });

      // Reset logs so re-seeding without a full wipe stays consistent with the run's current shape.
      await prisma.workflowRunLog.deleteMany({ where: { runId } });

      if (runSeed.log) {
        await prisma.workflowRunLog.create({
          data: {
            id: logId,
            runId,
            sequence: 0,
            stepId: spec.actionId,
            stepType: "send_email",
            status: runSeed.log.status,
            input: stepInput,
            output: stepOutput,
            error: runSeed.log.error ?? null,
            startedAt,
            finishedAt,
          },
        });
      }
    }
  }
}

async function deleteData(): Promise<void> {
  logger.info("Clearing existing data...");

  const deleteOrder: Prisma.TypeMap["meta"]["modelProps"][] = [
    "responseQuotaLink",
    "surveyQuota",
    "tagsOnResponses",
    "tag",
    "surveyFollowUp",
    "response",
    "display",
    "surveyTrigger",
    "surveyAttributeFilter",
    "surveyLanguage",
    "survey",
    "actionClass",
    "contactAttribute",
    "contactAttributeKey",
    "contact",
    "apiKeyWorkspace",
    "apiKey",
    "segment",
    "webhook",
    "integration",
    "dashboardWidget",
    "chart",
    "dashboard",
    "workspaceTeam",
    "teamUser",
    "team",
    "workspace",
    "invite",
    "membership",
    "account",
    "user",
    "organization",
  ];

  for (const model of deleteOrder) {
    try {
      // @ts-expect-error - prisma[model] is not typed correctly
      await prisma[model].deleteMany();
    } catch (e: unknown) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      logger.error(`Could not delete data from ${model}: ${errorMessage}`);
    }
  }

  logger.info("Data cleared.");
}

const KITCHEN_SINK_QUESTIONS: SurveyQuestion[] = [
  {
    id: createId(),
    type: "openText",
    headline: { default: "What do you think of Formbricks?" },
    subheader: { default: "Please be honest!" },
    required: true,
    placeholder: { default: "Your feedback here..." },
    longAnswer: true,
  },
  {
    id: createId(),
    type: "multipleChoiceSingle",
    headline: { default: "How often do you use Formbricks?" },
    required: true,
    choices: [
      { id: createId(), label: { default: "Daily" } },
      { id: createId(), label: { default: "Weekly" } },
      { id: createId(), label: { default: "Monthly" } },
      { id: createId(), label: { default: "Rarely" } },
    ],
  },
  {
    id: createId(),
    type: "multipleChoiceMulti",
    headline: { default: "Which features do you use?" },
    required: false,
    choices: [
      { id: createId(), label: { default: "Surveys" } },
      { id: createId(), label: { default: "Analytics" } },
      { id: createId(), label: { default: "Integrations" } },
      { id: createId(), label: { default: "Action Tracking" } },
    ],
  },
  {
    id: createId(),
    type: "nps",
    headline: { default: "How likely are you to recommend Formbricks?" },
    required: true,
    lowerLabel: { default: "Not likely" },
    upperLabel: { default: "Very likely" },
  },
  {
    id: createId(),
    type: "cta",
    headline: { default: "Check out our documentation!" },
    required: true,
    ctaButtonLabel: { default: "Go to Docs" },
    buttonUrl: "https://formbricks.com/docs",
    buttonExternal: true,
  },
  {
    id: createId(),
    type: "rating",
    headline: { default: "Rate your overall experience" },
    required: true,
    scale: "star",
    range: 5,
    lowerLabel: { default: "Poor" },
    upperLabel: { default: "Excellent" },
  },
  {
    id: createId(),
    type: "consent",
    headline: { default: "Do you agree to our terms?" },
    required: true,
    label: { default: "I agree to the terms and conditions" },
  },
  {
    id: createId(),
    type: "date",
    headline: { default: "When did you start using Formbricks?" },
    required: true,
    format: "M-d-y",
  },
  {
    id: createId(),
    type: "matrix",
    headline: { default: "How do you feel about these aspects?" },
    required: true,
    rows: [
      { id: createId(), label: { default: "UI Design" } },
      { id: createId(), label: { default: "Performance" } },
      { id: createId(), label: { default: "Documentation" } },
    ],
    columns: [
      { id: createId(), label: { default: "Disappointed" } },
      { id: createId(), label: { default: "Neutral" } },
      { id: createId(), label: { default: "Satisfied" } },
    ],
  },
  {
    id: createId(),
    type: "address",
    headline: { default: "Where are you located?" },
    required: true,
    addressLine1: { show: true, required: true, placeholder: { default: "Address Line 1" } },
    addressLine2: { show: true, required: false, placeholder: { default: "Address Line 2" } },
    city: { show: true, required: true, placeholder: { default: "City" } },
    state: { show: true, required: true, placeholder: { default: "State" } },
    zip: { show: true, required: true, placeholder: { default: "Zip" } },
    country: { show: true, required: true, placeholder: { default: "Country" } },
  },
  {
    id: createId(),
    type: "ranking",
    headline: { default: "Rank these features" },
    required: true,
    choices: [
      { id: createId(), label: { default: "Feature A" } },
      { id: createId(), label: { default: "Feature B" } },
      { id: createId(), label: { default: "Feature C" } },
    ],
  },
  {
    id: createId(),
    type: "contactInfo",
    headline: { default: "How can we reach you?" },
    required: true,
    firstName: { show: true, required: true, placeholder: { default: "First Name" } },
    lastName: { show: true, required: true, placeholder: { default: "Last Name" } },
    email: { show: true, required: true, placeholder: { default: "Email" } },
    phone: { show: true, required: false, placeholder: { default: "Phone" } },
    company: { show: true, required: false, placeholder: { default: "Company" } },
  },
];

interface SurveyBlock {
  id: string;
  name: string;
  elements: SurveyQuestion[];
}

type ResponseValue = string | number | string[] | Record<string, string>;

const generateQuestionResponse = (q: SurveyQuestion, index: number): ResponseValue | undefined => {
  const responseGenerators: Record<SurveyElementType, () => ResponseValue | undefined> = {
    openText: () => `Sample response ${String(index)}`,
    multipleChoiceSingle: () =>
      q.choices ? q.choices[Math.floor(Math.random() * q.choices.length)].label.default : undefined,
    multipleChoiceMulti: () =>
      q.choices ? [q.choices[0].label.default, q.choices[1].label.default] : undefined,
    nps: () => Math.floor(Math.random() * 11),
    rating: () => (q.range ? Math.floor(Math.random() * q.range) + 1 : undefined),
    cta: () => "clicked",
    consent: () => "accepted",
    date: () => new Date().toISOString().split("T")[0],
    matrix: () => {
      const matrixData: Record<string, string> = {};
      if (q.rows && q.columns) {
        for (const row of q.rows) {
          matrixData[row.label.default] =
            q.columns[Math.floor(Math.random() * q.columns.length)].label.default;
        }
      }
      return matrixData;
    },
    ranking: () =>
      q.choices ? q.choices.map((c) => c.label.default).sort(() => Math.random() - 0.5) : undefined,
    address: () => ({
      addressLine1: "Main St 1",
      city: "Berlin",
      state: "Berlin",
      zip: "10115",
      country: "Germany",
    }),
    contactInfo: () => ({
      firstName: "John",
      lastName: "Doe",
      email: `john.doe.${String(index)}@example.com`,
    }),
  };

  return responseGenerators[q.type]();
};

async function generateResponses(surveyId: string, count: number): Promise<void> {
  logger.info(`Generating ${String(count)} responses for survey ${surveyId}...`);
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
  });

  if (!survey) return;

  const blocks = survey.blocks as unknown as SurveyBlock[];
  const questions = blocks.flatMap((block) => block.elements);

  for (let i = 0; i < count; i++) {
    const data: Record<string, ResponseValue> = {};
    for (const q of questions) {
      const response = generateQuestionResponse(q, i);
      if (response !== undefined) {
        data[q.id] = response;
      }
    }

    await prisma.$transaction(async (tx) => {
      const display = await tx.display.create({
        data: {
          surveyId,
        },
      });

      await tx.response.create({
        data: {
          surveyId,
          finished: true,
          data,
          displayId: display.id,
        },
      });
    });
  }

  // Generate some displays without responses (e.g., 30% more)
  const extraDisplays = Math.floor(count * 0.3);
  logger.info(`Generating ${String(extraDisplays)} extra displays for survey ${surveyId}...`);

  for (let i = 0; i < extraDisplays; i++) {
    await prisma.display.create({
      data: {
        surveyId,
      },
    });
  }
}

async function main(): Promise<void> {
  if (clearData) {
    await deleteData();
  }

  logger.info("Seeding base infrastructure...");

  // Organization
  const organization = await prisma.organization.upsert({
    where: { id: SEED_IDS.ORGANIZATION },
    update: {},
    create: {
      id: SEED_IDS.ORGANIZATION,
      name: "Seed Organization",
    },
  });

  await prisma.organizationBilling.upsert({
    where: { organizationId: organization.id },
    update: {},
    create: {
      organizationId: organization.id,
      limits: { workspaces: 3, monthly: { responses: 1500 } },
      stripeCustomerId: null,
      usageCycleAnchor: new Date(),
    },
  });

  // Users
  const passwordHash = await hashPassword(SEED_CREDENTIALS.ADMIN.password, 10);

  await prisma.user.upsert({
    where: { id: SEED_IDS.USER_ADMIN },
    update: {},
    create: {
      id: SEED_IDS.USER_ADMIN,
      name: "Admin User",
      email: SEED_CREDENTIALS.ADMIN.email,
      password: passwordHash,
      emailVerified: new Date(),
      memberships: {
        create: {
          organizationId: organization.id,
          role: "owner",
          accepted: true,
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { id: SEED_IDS.USER_MANAGER },
    update: {},
    create: {
      id: SEED_IDS.USER_MANAGER,
      name: "Manager User",
      email: SEED_CREDENTIALS.MANAGER.email,
      password: passwordHash,
      emailVerified: new Date(),
      memberships: {
        create: {
          organizationId: organization.id,
          role: "manager",
          accepted: true,
        },
      },
    },
  });

  await prisma.user.upsert({
    where: { id: SEED_IDS.USER_MEMBER },
    update: {},
    create: {
      id: SEED_IDS.USER_MEMBER,
      name: "Member User",
      email: SEED_CREDENTIALS.MEMBER.email,
      password: passwordHash,
      emailVerified: new Date(),
      memberships: {
        create: {
          organizationId: organization.id,
          role: "member",
          accepted: true,
        },
      },
    },
  });

  // Workspace
  const workspace = await prisma.workspace.upsert({
    where: { id: SEED_IDS.WORKSPACE },
    update: {},
    create: {
      id: SEED_IDS.WORKSPACE,
      name: "Seed Workspace",
      organizationId: organization.id,
    },
  });

  // Keep seed defaults aligned with production v5 camelCase keys.
  // Safe-identifier migration is deferred to v5.1.
  // Contact attribute keys for the workspace
  const defaultAttributeKeys = [
    { name: "Email", key: "email", isUnique: true, type: "default" as const },
    { name: "First Name", key: "firstName", isUnique: false, type: "default" as const },
    { name: "Last Name", key: "lastName", isUnique: false, type: "default" as const },
    { name: "userId", key: "userId", isUnique: true, type: "default" as const },
    { name: "Language", key: "language", isUnique: false, type: "default" as const },
  ];

  for (const attr of defaultAttributeKeys) {
    await prisma.contactAttributeKey.upsert({
      where: { key_workspaceId: { key: attr.key, workspaceId: workspace.id } },
      update: {},
      create: { ...attr, workspaceId: workspace.id },
    });
  }

  logger.info("Seeding surveys...");

  const createSurveyWithBlocks = async (
    id: string,
    name: string,
    workspaceId: string,
    status: "inProgress" | "draft" | "completed",
    questions: SurveyQuestion[]
  ): Promise<void> => {
    const blocks = [
      {
        id: createId(),
        name: "Main Block",
        elements: questions.map((question) => ({
          required: false,
          ...question,
        })),
      },
    ] as unknown as TSurveyBlocks;

    await prisma.survey.upsert({
      where: { id },
      update: {
        workspaceId,
        type: "link",
        blocks,
      },
      create: {
        id,
        name,
        workspaceId,
        status,
        type: "link",
        blocks,
      },
    });
  };

  // Kitchen Sink Survey
  await createSurveyWithBlocks(
    SEED_IDS.SURVEY_KITCHEN_SINK,
    "Kitchen Sink Survey",
    workspace.id,
    "inProgress",
    KITCHEN_SINK_QUESTIONS
  );

  // CSAT Survey
  await createSurveyWithBlocks(SEED_IDS.SURVEY_CSAT, "CSAT Survey", workspace.id, "inProgress", [
    {
      id: createId(),
      type: "rating",
      headline: { default: "How satisfied are you with our product?" },
      required: true,
      scale: "smiley",
      range: 5,
    },
  ]);

  // Draft Survey
  await createSurveyWithBlocks(SEED_IDS.SURVEY_DRAFT, "Draft Survey", workspace.id, "draft", [
    {
      id: createId(),
      type: "openText",
      headline: { default: "Coming soon..." },
      required: false,
    },
  ]);

  // Completed Survey
  await createSurveyWithBlocks(SEED_IDS.SURVEY_COMPLETED, "Exit Survey", workspace.id, "completed", [
    {
      id: createId(),
      type: "multipleChoiceSingle",
      headline: { default: "Why are you leaving?" },
      required: true,
      choices: [
        { id: createId(), label: { default: "Too expensive" } },
        { id: createId(), label: { default: "Found a better alternative" } },
        { id: createId(), label: { default: "Missing features" } },
      ],
    },
  ]);

  logger.info("Generating responses...");

  await generateResponses(SEED_IDS.SURVEY_KITCHEN_SINK, 50);
  await generateResponses(SEED_IDS.SURVEY_CSAT, 50);
  await generateResponses(SEED_IDS.SURVEY_COMPLETED, 50);

  await seedDemoWorkflows(workspace.id, SEED_IDS.SURVEY_KITCHEN_SINK);

  logger.info(`\n${"=".repeat(50)}`);
  logger.info("SEEDING COMPLETED SUCCESSFULLY");
  logger.info("=".repeat(50));
  logger.info("\nLog in with the following credentials:");
  logger.info(`\n  Admin (Owner):`);
  logger.info(`    Email:    ${SEED_CREDENTIALS.ADMIN.email}`);
  logger.info(`    Password: (see SEED_CREDENTIALS configuration in constants.ts)`);
  logger.info(`\n  Manager:`);
  logger.info(`    Email:    ${SEED_CREDENTIALS.MANAGER.email}`);
  logger.info(`    Password: (see SEED_CREDENTIALS configuration in constants.ts)`);
  logger.info(`\n  Member:`);
  logger.info(`    Email:    ${SEED_CREDENTIALS.MEMBER.email}`);
  logger.info(`    Password: (see SEED_CREDENTIALS configuration in constants.ts)`);
  logger.info(`\n${"=".repeat(50)}\n`);
}

main()
  .catch((e: unknown) => {
    logger.error(e);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect().catch((e: unknown) => {
      logger.error(e, "Error disconnecting prisma");
    });
  });
