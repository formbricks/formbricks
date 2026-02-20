import { createId } from "@paralleldrive/cuid2";
import { type Prisma, PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { logger } from "@formbricks/logger";
import { SEED_CREDENTIALS, SEED_IDS } from "./seed/constants";

const prisma = new PrismaClient();

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
    "apiKeyEnvironment",
    "apiKey",
    "segment",
    "webhook",
    "integration",
    "dashboardWidget",
    "chart",
    "dashboard",
    "projectTeam",
    "teamUser",
    "team",
    "project",
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
          // @ts-expect-error - data is not typed correctly
          data: data as unknown as Prisma.InputJsonValue,
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
      billing: {
        plan: "free",
        limits: { projects: 3, monthly: { responses: 1500, miu: 2000 } },
        stripeCustomerId: null,
        periodStart: new Date(),
        period: "monthly",
      },
    },
  });

  // Users
  const passwordHash = await bcrypt.hash(SEED_CREDENTIALS.ADMIN.password, 10);

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

  // Project
  const project = await prisma.project.upsert({
    where: { id: SEED_IDS.PROJECT },
    update: {},
    create: {
      id: SEED_IDS.PROJECT,
      name: "Seed Project",
      organizationId: organization.id,
    },
  });

  // Environments
  await prisma.environment.upsert({
    where: { id: SEED_IDS.ENV_DEV },
    update: { appSetupCompleted: false },
    create: {
      id: SEED_IDS.ENV_DEV,
      type: "development",
      projectId: project.id,
      appSetupCompleted: false,
      attributeKeys: {
        create: [
          { name: "Email", key: "email", isUnique: true, type: "default" },
          { name: "First Name", key: "firstName", isUnique: false, type: "default" },
          { name: "Last Name", key: "lastName", isUnique: false, type: "default" },
          { name: "userId", key: "userId", isUnique: true, type: "default" },
          { name: "Language", key: "language", isUnique: false, type: "default" },
        ],
      },
    },
  });

  const prodEnv = await prisma.environment.upsert({
    where: { id: SEED_IDS.ENV_PROD },
    update: { appSetupCompleted: false },
    create: {
      id: SEED_IDS.ENV_PROD,
      type: "production",
      projectId: project.id,
      appSetupCompleted: false,
      attributeKeys: {
        create: [
          { name: "Email", key: "email", isUnique: true, type: "default" },
          { name: "First Name", key: "firstName", isUnique: false, type: "default" },
          { name: "Last Name", key: "lastName", isUnique: false, type: "default" },
          { name: "userId", key: "userId", isUnique: true, type: "default" },
          { name: "Language", key: "language", isUnique: false, type: "default" },
        ],
      },
    },
  });

  logger.info("Seeding surveys...");

  const createSurveyWithBlocks = async (
    id: string,
    name: string,
    environmentId: string,
    status: "inProgress" | "draft" | "completed",
    questions: SurveyQuestion[]
  ): Promise<void> => {
    const blocks = [
      {
        id: createId(),
        name: "Main Block",
        elements: questions,
      },
    ];

    await prisma.survey.upsert({
      where: { id },
      update: {
        environmentId,
        type: "link",
        // @ts-expect-error - blocks is not typed correctly
        blocks: blocks as unknown as Prisma.InputJsonValue[],
      },
      create: {
        id,
        name,
        environmentId,
        status,
        type: "link",
        // @ts-expect-error - blocks is not typed correctly
        blocks: blocks as unknown as Prisma.InputJsonValue[],
      },
    });
  };

  // Kitchen Sink Survey
  await createSurveyWithBlocks(
    SEED_IDS.SURVEY_KITCHEN_SINK,
    "Kitchen Sink Survey",
    prodEnv.id,
    "inProgress",
    KITCHEN_SINK_QUESTIONS
  );

  // CSAT Survey
  await createSurveyWithBlocks(SEED_IDS.SURVEY_CSAT, "CSAT Survey", prodEnv.id, "inProgress", [
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
  await createSurveyWithBlocks(SEED_IDS.SURVEY_DRAFT, "Draft Survey", prodEnv.id, "draft", [
    {
      id: createId(),
      type: "openText",
      headline: { default: "Coming soon..." },
      required: false,
    },
  ]);

  // Completed Survey
  await createSurveyWithBlocks(SEED_IDS.SURVEY_COMPLETED, "Exit Survey", prodEnv.id, "completed", [
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

  // Charts & Dashboards
  logger.info("Seeding charts and dashboards...");

  const chartResponsesOverTime = await prisma.chart.upsert({
    where: { id: SEED_IDS.CHART_RESPONSES_OVER_TIME },
    update: {},
    create: {
      id: SEED_IDS.CHART_RESPONSES_OVER_TIME,
      name: "Responses Over Time",
      type: "line",
      projectId: project.id,
      createdBy: SEED_IDS.USER_ADMIN,
      query: {
        measures: ["FeedbackRecords.count"],
        timeDimensions: [{ dimension: "FeedbackRecords.createdAt", granularity: "week" }],
      },
      config: {
        xAxisLabel: "Week",
        yAxisLabel: "Responses",
        showGrid: true,
        showLegend: false,
      },
    },
  });

  const chartSatisfactionDist = await prisma.chart.upsert({
    where: { id: SEED_IDS.CHART_SATISFACTION_DIST },
    update: {},
    create: {
      id: SEED_IDS.CHART_SATISFACTION_DIST,
      name: "Satisfaction Distribution",
      type: "pie",
      projectId: project.id,
      createdBy: SEED_IDS.USER_ADMIN,
      query: {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.rating"],
      },
      config: {
        showLegend: true,
        legendPosition: "right",
        colors: ["#ef4444", "#f97316", "#eab308", "#22c55e", "#10b981"],
      },
    },
  });

  const chartNpsScore = await prisma.chart.upsert({
    where: { id: SEED_IDS.CHART_NPS_SCORE },
    update: {},
    create: {
      id: SEED_IDS.CHART_NPS_SCORE,
      name: "NPS Score",
      type: "big_number",
      projectId: project.id,
      createdBy: SEED_IDS.USER_ADMIN,
      query: {
        measures: ["FeedbackRecords.npsScore"],
      },
      config: {
        prefix: "",
        suffix: "",
        numberFormat: "0",
      },
    },
  });

  const chartCompletionRate = await prisma.chart.upsert({
    where: { id: SEED_IDS.CHART_COMPLETION_RATE },
    update: {},
    create: {
      id: SEED_IDS.CHART_COMPLETION_RATE,
      name: "Survey Completion Rate",
      type: "bar",
      projectId: project.id,
      createdBy: SEED_IDS.USER_MANAGER,
      query: {
        measures: ["FeedbackRecords.completionRate"],
        dimensions: ["FeedbackRecords.surveyName"],
      },
      config: {
        xAxisLabel: "Survey",
        yAxisLabel: "Completion %",
        showValues: true,
        showGrid: true,
        colors: ["#6366f1"],
      },
    },
  });

  const chartTopChannels = await prisma.chart.upsert({
    where: { id: SEED_IDS.CHART_TOP_CHANNELS },
    update: {},
    create: {
      id: SEED_IDS.CHART_TOP_CHANNELS,
      name: "Responses by Channel",
      type: "area",
      projectId: project.id,
      createdBy: SEED_IDS.USER_ADMIN,
      query: {
        measures: ["FeedbackRecords.count"],
        dimensions: ["FeedbackRecords.channel"],
        timeDimensions: [{ dimension: "FeedbackRecords.createdAt", granularity: "month" }],
      },
      config: {
        stacked: true,
        showLegend: true,
        legendPosition: "bottom",
        showGrid: true,
      },
    },
  });

  // Dashboard: Overview
  const dashboardOverview = await prisma.dashboard.upsert({
    where: { id: SEED_IDS.DASHBOARD_OVERVIEW },
    update: {},
    create: {
      id: SEED_IDS.DASHBOARD_OVERVIEW,
      name: "Overview",
      description: "High-level metrics across all surveys",
      projectId: project.id,
      createdBy: SEED_IDS.USER_ADMIN,
    },
  });

  // Dashboard: Survey Performance
  const dashboardSurveyPerf = await prisma.dashboard.upsert({
    where: { id: SEED_IDS.DASHBOARD_SURVEY_PERF },
    update: {},
    create: {
      id: SEED_IDS.DASHBOARD_SURVEY_PERF,
      name: "Survey Performance",
      description: "Detailed survey completion and response metrics",
      projectId: project.id,
      createdBy: SEED_IDS.USER_MANAGER,
    },
  });

  // Widgets for Overview dashboard
  await prisma.dashboardWidget.upsert({
    where: { id: SEED_IDS.WIDGET_OVERVIEW_NPS },
    update: {},
    create: {
      id: SEED_IDS.WIDGET_OVERVIEW_NPS,
      dashboardId: dashboardOverview.id,
      chartId: chartNpsScore.id,
      title: "Current NPS",
      layout: { x: 0, y: 0, w: 2, h: 2 },
      order: 0,
    },
  });
  await prisma.dashboardWidget.upsert({
    where: { id: SEED_IDS.WIDGET_OVERVIEW_RESPONSES },
    update: {},
    create: {
      id: SEED_IDS.WIDGET_OVERVIEW_RESPONSES,
      dashboardId: dashboardOverview.id,
      chartId: chartResponsesOverTime.id,
      title: "Weekly Responses",
      layout: { x: 2, y: 0, w: 4, h: 3 },
      order: 1,
    },
  });
  await prisma.dashboardWidget.upsert({
    where: { id: SEED_IDS.WIDGET_OVERVIEW_SATISFACTION },
    update: {},
    create: {
      id: SEED_IDS.WIDGET_OVERVIEW_SATISFACTION,
      dashboardId: dashboardOverview.id,
      chartId: chartSatisfactionDist.id,
      title: "Satisfaction Breakdown",
      layout: { x: 0, y: 3, w: 3, h: 3 },
      order: 2,
    },
  });
  await prisma.dashboardWidget.upsert({
    where: { id: SEED_IDS.WIDGET_OVERVIEW_CHANNELS },
    update: {},
    create: {
      id: SEED_IDS.WIDGET_OVERVIEW_CHANNELS,
      dashboardId: dashboardOverview.id,
      chartId: chartTopChannels.id,
      title: "Channel Trends",
      layout: { x: 3, y: 3, w: 3, h: 3 },
      order: 3,
    },
  });

  // Widgets for Survey Performance dashboard
  await prisma.dashboardWidget.upsert({
    where: { id: SEED_IDS.WIDGET_SURVPERF_COMPLETION },
    update: {},
    create: {
      id: SEED_IDS.WIDGET_SURVPERF_COMPLETION,
      dashboardId: dashboardSurveyPerf.id,
      chartId: chartCompletionRate.id,
      title: "Completion by Survey",
      layout: { x: 0, y: 0, w: 6, h: 3 },
      order: 0,
    },
  });
  await prisma.dashboardWidget.upsert({
    where: { id: SEED_IDS.WIDGET_SURVPERF_RESPONSES },
    update: {},
    create: {
      id: SEED_IDS.WIDGET_SURVPERF_RESPONSES,
      dashboardId: dashboardSurveyPerf.id,
      chartId: chartResponsesOverTime.id,
      title: "Response Volume",
      layout: { x: 0, y: 3, w: 4, h: 3 },
      order: 1,
    },
  });
  await prisma.dashboardWidget.upsert({
    where: { id: SEED_IDS.WIDGET_SURVPERF_NPS },
    update: {},
    create: {
      id: SEED_IDS.WIDGET_SURVPERF_NPS,
      dashboardId: dashboardSurveyPerf.id,
      chartId: chartNpsScore.id,
      title: "NPS Tracker",
      layout: { x: 4, y: 3, w: 2, h: 2 },
      order: 2,
    },
  });

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
