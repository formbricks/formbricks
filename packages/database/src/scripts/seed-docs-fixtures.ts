/**
 * Seeds the ACME Inc. workspace that every screenshot in `docs/` is captured from.
 *
 * Why a separate script rather than an addition to `seed.ts`: `db:seed` is what every developer runs
 * to get a workable local instance, and its content shows up in nobody's published output. This
 * fixture's content ships — it is visible in ~200 public documentation images — so it is versioned,
 * reviewed and changed on its own terms. Editing `seed.ts` to brand it ACME would push a docs concern
 * into every developer's database.
 *
 * The demo company is a financial services firm because that matches our ICP: a prospect reading the
 * docs should recognise the survey they are looking at. Everything is fictional, and no email address
 * in it resolves to a real inbox.
 *
 * Requires `db:seed` to have run first — the admin user comes from there, so one login
 * (SEED_CREDENTIALS.ADMIN) reaches both the seed workspace and this one.
 *
 * Run: pnpm --filter @formbricks/database db:seed:docs
 */
import { createId } from "@paralleldrive/cuid2";
import { logger } from "@formbricks/logger";
import { type TSurveyBlocks } from "@formbricks/types/surveys/blocks";
import { PrismaClient } from "../prisma";
import { createPrismaPgAdapter } from "../prisma-adapter";
import { SEED_IDS } from "../seed/constants";

const prisma = new PrismaClient({ adapter: createPrismaPgAdapter().adapter });

if (process.env.NODE_ENV === "production" && process.env.ALLOW_SEED !== "true") {
  logger.error("ERROR: Seeding blocked in production. Set ALLOW_SEED=true to override.");
  process.exit(1);
}

/**
 * Fixed ids so the capture script can address a survey without querying for it, and so re-running
 * this script updates the same rows instead of accumulating duplicates.
 */
export const DOCS_IDS = {
  ORGANIZATION: "cldocsacmeorg00000000001",
  WORKSPACE: "cldocsacmeworkspace000001",
  SURVEY_ALL_ELEMENTS: "cldocsallelements00000001",
} as const;

/** Shown in the breadcrumb of nearly every screenshot, so it is part of the docs' visual identity. */
const ORGANIZATION_NAME = "ACME Inc.";
const WORKSPACE_NAME = "Retail Banking";

/**
 * One survey carrying all 17 element types, in the order the Question Types nav lists them.
 *
 * This exists so the 15 question-type pages can be captured in a single pass: seed once, open the
 * editor once, expand each card in turn. Copy is ACME's, not Formbricks' — a reader on
 * `question-type/nps` should see a bank asking a bank's question.
 *
 * `pictureSelection` is deliberately absent: its choices are `ZStorageUrl` values, so it needs real
 * uploaded files to render thumbnails rather than broken images. The capture script uploads those and
 * appends the element, keeping this file free of storage paths that only exist on one machine.
 */
const ACME_ELEMENTS = [
  {
    id: "acme-openText",
    type: "openText",
    headline: { default: "What made you open an account with us?" },
    subheader: { default: "A sentence or two is plenty." },
    required: true,
    placeholder: { default: "Type your answer here..." },
    longAnswer: true,
  },
  {
    id: "acme-multipleChoiceSingle",
    type: "multipleChoiceSingle",
    headline: { default: "Which account did you open?" },
    required: true,
    choices: [
      { id: createId(), label: { default: "Everyday Checking" } },
      { id: createId(), label: { default: "High-Yield Savings" } },
      { id: createId(), label: { default: "Joint Account" } },
      { id: createId(), label: { default: "Business Account" } },
    ],
  },
  {
    id: "acme-multipleChoiceMulti",
    type: "multipleChoiceMulti",
    headline: { default: "Which of these do you use at least monthly?" },
    required: false,
    choices: [
      { id: createId(), label: { default: "Mobile app" } },
      { id: createId(), label: { default: "Online banking" } },
      { id: createId(), label: { default: "Branch visit" } },
      { id: createId(), label: { default: "Telephone banking" } },
    ],
  },
  {
    id: "acme-nps",
    type: "nps",
    headline: { default: "How likely are you to recommend ACME to a friend or colleague?" },
    required: true,
    lowerLabel: { default: "Not at all likely" },
    upperLabel: { default: "Extremely likely" },
  },
  {
    id: "acme-csat",
    type: "csat",
    headline: { default: "How satisfied are you with your account opening experience?" },
    required: true,
    scale: "smiley",
    range: 5,
    lowerLabel: { default: "Very unsatisfied" },
    upperLabel: { default: "Very satisfied" },
    isColorCodingEnabled: true,
  },
  {
    id: "acme-ces",
    type: "ces",
    headline: { default: "Opening my account was easy." },
    required: true,
    scale: "number",
    range: 7,
    lowerLabel: { default: "Strongly disagree" },
    upperLabel: { default: "Strongly agree" },
  },
  {
    id: "acme-rating",
    type: "rating",
    headline: { default: "How would you rate our mobile app?" },
    required: true,
    scale: "star",
    range: 5,
    lowerLabel: { default: "Poor" },
    upperLabel: { default: "Excellent" },
  },
  {
    id: "acme-ranking",
    type: "ranking",
    headline: { default: "Rank these by how much they matter to you." },
    required: true,
    choices: [
      { id: createId(), label: { default: "No monthly fees" } },
      { id: createId(), label: { default: "Higher interest rate" } },
      { id: createId(), label: { default: "Faster support" } },
      { id: createId(), label: { default: "Better mobile app" } },
    ],
  },
  {
    id: "acme-matrix",
    type: "matrix",
    headline: { default: "How do you feel about each of these?" },
    required: true,
    rows: [
      { id: createId(), label: { default: "Opening an account" } },
      { id: createId(), label: { default: "Making a transfer" } },
      { id: createId(), label: { default: "Reaching support" } },
    ],
    columns: [
      { id: createId(), label: { default: "Difficult" } },
      { id: createId(), label: { default: "Neutral" } },
      { id: createId(), label: { default: "Easy" } },
    ],
  },
  {
    id: "acme-date",
    type: "date",
    headline: { default: "When did you open your account?" },
    required: false,
    format: "M-d-y",
  },
  {
    id: "acme-fileUpload",
    type: "fileUpload",
    headline: { default: "Upload a document to verify your address" },
    subheader: { default: "A utility bill or bank statement from the last three months." },
    required: false,
    allowMultipleFiles: false,
    maxSizeInMB: 10,
  },
  {
    id: "acme-cal",
    type: "cal",
    headline: { default: "Book a call with an advisor" },
    subheader: { default: "Pick a time that suits you." },
    required: false,
    calUserName: "acme-advisors",
  },
  {
    id: "acme-consent",
    type: "consent",
    headline: { default: "Marketing preferences" },
    required: false,
    label: { default: "ACME may contact me about products and offers" },
  },
  {
    id: "acme-contactInfo",
    type: "contactInfo",
    headline: { default: "How can we reach you?" },
    required: false,
    firstName: { show: true, required: true, placeholder: { default: "First name" } },
    lastName: { show: true, required: true, placeholder: { default: "Last name" } },
    email: { show: true, required: true, placeholder: { default: "Email" } },
    phone: { show: true, required: false, placeholder: { default: "Phone" } },
    company: { show: false, required: false, placeholder: { default: "Company" } },
  },
  {
    id: "acme-address",
    type: "address",
    headline: { default: "What is your current address?" },
    required: false,
    addressLine1: { show: true, required: true, placeholder: { default: "Address line 1" } },
    addressLine2: { show: true, required: false, placeholder: { default: "Address line 2" } },
    city: { show: true, required: true, placeholder: { default: "City" } },
    state: { show: true, required: true, placeholder: { default: "State" } },
    zip: { show: true, required: true, placeholder: { default: "ZIP" } },
    country: { show: true, required: true, placeholder: { default: "Country" } },
  },
  {
    id: "acme-cta",
    type: "cta",
    headline: { default: "See how your savings could grow" },
    required: false,
    ctaButtonLabel: { default: "Open the calculator" },
    buttonUrl: "https://example.com/acme/savings-calculator",
    buttonExternal: true,
  },
];

async function main(): Promise<void> {
  const organization = await prisma.organization.upsert({
    where: { id: DOCS_IDS.ORGANIZATION },
    update: { name: ORGANIZATION_NAME },
    create: { id: DOCS_IDS.ORGANIZATION, name: ORGANIZATION_NAME },
  });

  // The admin from `db:seed` owns this org too, so one login reaches both workspaces and no
  // screenshot session needs a second set of credentials.
  await prisma.membership.upsert({
    where: { userId_organizationId: { userId: SEED_IDS.USER_ADMIN, organizationId: organization.id } },
    update: { role: "owner" },
    create: { userId: SEED_IDS.USER_ADMIN, organizationId: organization.id, role: "owner", accepted: true },
  });

  const workspace = await prisma.workspace.upsert({
    where: { id: DOCS_IDS.WORKSPACE },
    update: { name: WORKSPACE_NAME },
    create: { id: DOCS_IDS.WORKSPACE, name: WORKSPACE_NAME, organizationId: organization.id },
  });

  const blocks = [
    {
      id: createId(),
      name: "Account opening feedback",
      elements: ACME_ELEMENTS,
    },
  ] as unknown as TSurveyBlocks;

  await prisma.survey.upsert({
    where: { id: DOCS_IDS.SURVEY_ALL_ELEMENTS },
    update: { workspaceId: workspace.id, blocks },
    create: {
      id: DOCS_IDS.SURVEY_ALL_ELEMENTS,
      name: "Account opening feedback",
      workspaceId: workspace.id,
      status: "inProgress",
      type: "link",
      blocks,
    },
  });

  logger.info(
    {
      organization: ORGANIZATION_NAME,
      workspace: WORKSPACE_NAME,
      workspaceId: workspace.id,
      elements: ACME_ELEMENTS.length,
    },
    "Docs fixtures seeded"
  );
}

main()
  .catch((error: unknown) => {
    logger.error(error, "Failed to seed docs fixtures");
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
