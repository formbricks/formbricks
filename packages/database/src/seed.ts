import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { SEED_CREDENTIALS, SEED_IDS } from "./seed/constants";

const prisma = new PrismaClient();

const isProduction = process.env.NODE_ENV === "production";
const allowSeed = process.env.ALLOW_SEED === "true";

if (isProduction && !allowSeed) {
  console.error("ERROR: Seeding blocked in production. Set ALLOW_SEED=true to override.");
  process.exit(1);
}

const clearData = process.argv.includes("--clear");

async function deleteData() {
  console.log("Clearing existing data...");
  const deleteOrder = [
    "ResponseQuotaLink",
    "SurveyQuota",
    "TagsOnResponses",
    "Tag",
    "SurveyFollowUp",
    "Response",
    "Display",
    "SurveyTrigger",
    "SurveyAttributeFilter",
    "SurveyLanguage",
    "Survey",
    "ActionClass",
    "ContactAttribute",
    "ContactAttributeKey",
    "Contact",
    "ApiKeyEnvironment",
    "ApiKey",
    "Segment",
    "Webhook",
    "Integration",
    "ProjectTeam",
    "TeamUser",
    "Team",
    "Project",
    "Invite",
    "Membership",
    "Account",
    "User",
    "Organization",
    "DataMigration",
    "Language",
  ];

  for (const model of deleteOrder) {
    try {
      // @ts-ignore
      await prisma[model.charAt(0).toLowerCase() + model.slice(1)].deleteMany();
    } catch (e) {
      console.warn(`Could not delete data from ${model}: ${e.message}`);
    }
  }
  console.log("Data cleared.");
}

const KITCHEN_SINK_QUESTIONS = [
  {
    id: "q_open_text",
    type: "openText",
    headline: { default: "What do you think of Formbricks?" },
    subheader: { default: "Please be honest!" },
    required: true,
    placeholder: { default: "Your feedback here..." },
    longAnswer: true,
  },
  {
    id: "q_multiple_choice_single",
    type: "multipleChoiceSingle",
    headline: { default: "How often do you use Formbricks?" },
    required: true,
    choices: [
      { id: "choice_1", label: { default: "Daily" } },
      { id: "choice_2", label: { default: "Weekly" } },
      { id: "choice_3", label: { default: "Monthly" } },
      { id: "choice_4", label: { default: "Rarely" } },
    ],
  },
  {
    id: "q_multiple_choice_multi",
    type: "multipleChoiceMulti",
    headline: { default: "Which features do you use?" },
    required: false,
    choices: [
      { id: "choice_1", label: { default: "Surveys" } },
      { id: "choice_2", label: { default: "Analytics" } },
      { id: "choice_3", label: { default: "Integrations" } },
      { id: "choice_4", label: { default: "Action Tracking" } },
    ],
  },
  {
    id: "q_nps",
    type: "nps",
    headline: { default: "How likely are you to recommend Formbricks?" },
    required: true,
    lowerLabel: { default: "Not likely" },
    upperLabel: { default: "Very likely" },
  },
  {
    id: "q_cta",
    type: "cta",
    headline: { default: "Check out our documentation!" },
    required: true,
    buttonLabel: { default: "Go to Docs" },
    buttonUrl: "https://formbricks.com/docs",
    buttonExternal: true,
    dismissButtonLabel: { default: "Skip" },
  },
  {
    id: "q_rating",
    type: "rating",
    headline: { default: "Rate your overall experience" },
    required: true,
    scale: "star",
    range: 5,
    lowerLabel: { default: "Poor" },
    upperLabel: { default: "Excellent" },
  },
  {
    id: "q_consent",
    type: "consent",
    headline: { default: "Do you agree to our terms?" },
    required: true,
    label: { default: "I agree to the terms and conditions" },
  },
  {
    id: "q_picture_selection",
    type: "pictureSelection",
    headline: { default: "Which logo do you prefer?" },
    required: true,
    allowMulti: false,
    choices: [
      { id: "pic_1", imageUrl: "https://formbricks.com/logo-dark.png" },
      { id: "pic_2", imageUrl: "https://formbricks.com/logo-light.png" },
    ],
  },
  {
    id: "q_date",
    type: "date",
    headline: { default: "When did you start using Formbricks?" },
    required: true,
    format: "M-d-y",
  },
  {
    id: "q_matrix",
    type: "matrix",
    headline: { default: "How do you feel about these aspects?" },
    required: true,
    rows: [
      { id: "row_1", label: { default: "UI Design" } },
      { id: "row_2", label: { default: "Performance" } },
      { id: "row_3", label: { default: "Documentation" } },
    ],
    columns: [
      { id: "col_1", label: { default: "Disappointed" } },
      { id: "col_2", label: { default: "Neutral" } },
      { id: "col_3", label: { default: "Satisfied" } },
    ],
  },
  {
    id: "q_address",
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
    id: "q_ranking",
    type: "ranking",
    headline: { default: "Rank these features" },
    required: true,
    choices: [
      { id: "rank_1", label: { default: "Feature A" } },
      { id: "rank_2", label: { default: "Feature B" } },
      { id: "rank_3", label: { default: "Feature C" } },
    ],
  },
  {
    id: "q_contact_info",
    type: "contactInfo",
    headline: { default: "How can we reach you?" },
    required: true,
    firstName: { show: true, required: true, placeholder: { default: "First Name" } },
    lastName: { show: true, required: true, placeholder: { default: "Last Name" } },
    email: { show: true, required: true, placeholder: { default: "Email" } },
    phone: { show: true, required: false, placeholder: { default: "Phone" } },
    company: { show: true, required: false, placeholder: { default: "Company" } },
  },
  {
    id: "q_file_upload",
    type: "fileUpload",
    headline: { default: "Upload your logo" },
    required: false,
    allowMultipleFiles: true,
    maxSizeInMB: 5,
  },
];

async function generateResponses(surveyId: string, count: number) {
  console.log(`Generating ${count} responses for survey ${surveyId}...`);
  const survey = await prisma.survey.findUnique({
    where: { id: surveyId },
  });

  if (!survey) return;

  const questions = survey.questions as any[];

  for (let i = 0; i < count; i++) {
    const data: Record<string, any> = {};
    questions.forEach((q) => {
      switch (q.type) {
        case "openText":
          data[q.id] = `Sample response ${i}`;
          break;
        case "multipleChoiceSingle":
          data[q.id] = q.choices[Math.floor(Math.random() * q.choices.length)].label.default;
          break;
        case "multipleChoiceMulti":
          data[q.id] = [q.choices[0].label.default, q.choices[1].label.default];
          break;
        case "nps":
          data[q.id] = Math.floor(Math.random() * 11);
          break;
        case "rating":
          data[q.id] = Math.floor(Math.random() * q.range) + 1;
          break;
        case "cta":
          data[q.id] = "clicked";
          break;
        case "consent":
          data[q.id] = "accepted";
          break;
        case "date":
          data[q.id] = new Date().toISOString().split("T")[0];
          break;
        case "matrix":
          const matrixData: Record<string, string> = {};
          q.rows.forEach((row: any) => {
            matrixData[row.label.default] =
              q.columns[Math.floor(Math.random() * q.columns.length)].label.default;
          });
          data[q.id] = matrixData;
          break;
        case "ranking":
          data[q.id] = q.choices.map((c: any) => c.label.default).sort(() => Math.random() - 0.5);
          break;
        case "address":
          data[q.id] = {
            addressLine1: "Main St 1",
            city: "Berlin",
            state: "Berlin",
            zip: "10115",
            country: "Germany",
          };
          break;
        case "contactInfo":
          data[q.id] = {
            firstName: "John",
            lastName: "Doe",
            email: `john.doe.${i}@example.com`,
          };
          break;
        default:
          data[q.id] = "Sample data";
      }
    });

    await prisma.response.create({
      data: {
        surveyId,
        finished: true,
        data,
      },
    });
  }
}

async function main() {
  if (clearData) {
    await deleteData();
  }

  console.log("Seeding base infrastructure...");

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

  const admin = await prisma.user.upsert({
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

  const manager = await prisma.user.upsert({
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
  const devEnv = await prisma.environment.upsert({
    where: { id: SEED_IDS.ENV_DEV },
    update: {},
    create: {
      id: SEED_IDS.ENV_DEV,
      type: "development",
      projectId: project.id,
      attributeKeys: {
        create: [
          { name: "Email", key: "email", isUnique: true, type: "default" },
          { name: "First Name", key: "firstName", isUnique: false, type: "default" },
          { name: "Last Name", key: "lastName", isUnique: false, type: "default" },
          { name: "userId", key: "userId", isUnique: true, type: "default" },
        ],
      },
    },
  });

  const prodEnv = await prisma.environment.upsert({
    where: { id: SEED_IDS.ENV_PROD },
    update: {},
    create: {
      id: SEED_IDS.ENV_PROD,
      type: "production",
      projectId: project.id,
      attributeKeys: {
        create: [
          { name: "Email", key: "email", isUnique: true, type: "default" },
          { name: "First Name", key: "firstName", isUnique: false, type: "default" },
          { name: "Last Name", key: "lastName", isUnique: false, type: "default" },
          { name: "userId", key: "userId", isUnique: true, type: "default" },
        ],
      },
    },
  });

  console.log("Seeding surveys...");

  // Kitchen Sink Survey
  await prisma.survey.upsert({
    where: { id: SEED_IDS.SURVEY_KITCHEN_SINK },
    update: {},
    create: {
      id: SEED_IDS.SURVEY_KITCHEN_SINK,
      name: "Kitchen Sink Survey",
      environmentId: devEnv.id,
      status: "inProgress",
      type: "app",
      questions: KITCHEN_SINK_QUESTIONS,
    },
  });

  // CSAT Survey
  await prisma.survey.upsert({
    where: { id: SEED_IDS.SURVEY_CSAT },
    update: {},
    create: {
      id: SEED_IDS.SURVEY_CSAT,
      name: "CSAT Survey",
      environmentId: devEnv.id,
      status: "inProgress",
      type: "app",
      questions: [
        {
          id: "csat_rating",
          type: "rating",
          headline: { default: "How satisfied are you with our product?" },
          required: true,
          scale: "smiley",
          range: 5,
        },
      ],
    },
  });

  // Draft Survey
  await prisma.survey.upsert({
    where: { id: SEED_IDS.SURVEY_DRAFT },
    update: {},
    create: {
      id: SEED_IDS.SURVEY_DRAFT,
      name: "Draft Survey",
      environmentId: devEnv.id,
      status: "draft",
      type: "app",
      questions: [
        {
          id: "draft_q1",
          type: "openText",
          headline: { default: "Coming soon..." },
          required: false,
        },
      ],
    },
  });

  // Completed Survey
  await prisma.survey.upsert({
    where: { id: SEED_IDS.SURVEY_COMPLETED },
    update: {},
    create: {
      id: SEED_IDS.SURVEY_COMPLETED,
      name: "Exit Survey",
      environmentId: devEnv.id,
      status: "completed",
      type: "app",
      questions: [
        {
          id: "exit_q1",
          type: "multipleChoiceSingle",
          headline: { default: "Why are you leaving?" },
          required: true,
          choices: [
            { id: "c1", label: { default: "Too expensive" } },
            { id: "c2", label: { default: "Found a better alternative" } },
            { id: "c3", label: { default: "Missing features" } },
          ],
        },
      ],
    },
  });

  console.log("Generating responses...");
  await generateResponses(SEED_IDS.SURVEY_KITCHEN_SINK, 50);
  await generateResponses(SEED_IDS.SURVEY_CSAT, 50);
  await generateResponses(SEED_IDS.SURVEY_COMPLETED, 50);

  console.log("Seeding completed successfully.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
