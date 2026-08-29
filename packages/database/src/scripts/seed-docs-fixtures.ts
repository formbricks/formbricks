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
  /** An app survey. Several settings — Visibility & Recontact, targeting — only exist for this type. */
  SURVEY_APP: "cldocsappsurvey000000001",
  SURVEY_PIN: "cldocspinsurvey000000001",
  SURVEY_VERIFY_EMAIL: "cldocsverifyemail00000001",
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

/**
 * Answers keyed by element id. Written rather than randomised: these show up in the response table,
 * the summary charts and the drop-off analysis in the docs, and random noise reads as broken data.
 */
/**
 * Answers keyed by element id. Deliberately **partial**: six of the sixteen elements — address, cal,
 * contactInfo, cta, date and fileUpload — are left unanswered so the response table has empty cells,
 * which is what a real one looks like. Typed as `Partial` so the lookup below is honestly optional;
 * a total `Record` would type the miss away and hand `pick` an `undefined` to index.
 */
const ANSWER_POOL: Partial<Record<string, unknown[]>> = {
  "acme-openText": [
    "The mobile app finally supports joint accounts, which is why I switched.",
    "Better savings rate than my old bank, and the switch took ten minutes.",
    "My employer moved payroll here so I opened an account to match.",
    "I wanted an account I could open without visiting a branch.",
  ],
  "acme-multipleChoiceSingle": [
    "Everyday Checking",
    "High-Yield Savings",
    "Joint Account",
    "Business Account",
  ],
  "acme-multipleChoiceMulti": [
    ["Mobile app", "Online banking"],
    ["Mobile app"],
    ["Online banking", "Branch visit"],
    ["Mobile app", "Telephone banking"],
  ],
  "acme-nps": [9, 8, 10, 7, 6, 9],
  "acme-csat": [5, 4, 5, 3, 4],
  "acme-ces": [6, 7, 5, 7, 4],
  "acme-rating": [5, 4, 5, 3, 4],
  "acme-ranking": [
    ["No monthly fees", "Higher interest rate", "Better mobile app", "Faster support"],
    ["Higher interest rate", "No monthly fees", "Faster support", "Better mobile app"],
  ],
  "acme-matrix": [
    { "Opening an account": "Easy", "Making a transfer": "Easy", "Reaching support": "Neutral" },
    { "Opening an account": "Neutral", "Making a transfer": "Easy", "Reaching support": "Difficult" },
  ],
  "acme-consent": ["accepted", "dismissed"],
};

/**
 * Plausible traffic mix, so the metadata card and its filters show something worth filtering.
 *
 * `source` deliberately carries campaign names on some rows and the bare survey type on others.
 * That is exactly what the column holds in reality: `getWebSurveyMeta` in
 * `packages/surveys/src/components/general/survey.tsx` writes `?source=` straight into it when the
 * respondent arrives with one, and falls back to the survey's type when they do not. Every row
 * reading "link" would make `source-tracking.mdx` impossible to illustrate.
 */
const RESPONSE_META = [
  {
    source: "newsletter",
    url: "https://example.com/acme/welcome?source=newsletter",
    country: "United States",
    userAgent: { browser: "Chrome", os: "macOS", device: "desktop" },
  },
  {
    source: "link",
    url: "https://example.com/acme/welcome",
    country: "United Kingdom",
    userAgent: { browser: "Safari", os: "iOS", device: "phone" },
  },
  {
    source: "app",
    url: "https://app.example.com/accounts",
    country: "Germany",
    action: "Opened account page",
    userAgent: { browser: "Firefox", os: "Windows", device: "desktop" },
  },
  {
    source: "in-branch-qr",
    url: "https://example.com/acme/welcome?source=in-branch-qr",
    country: "Canada",
    userAgent: { browser: "Chrome", os: "Android", device: "phone" },
  },
];

const pick = <T>(pool: T[], i: number): T => pool[i % pool.length];

/**
 * Seeds responses for the ACME survey.
 *
 * A third are left unfinished on purpose. `partial-submissions.mdx` documents the "Analyze Drop-Offs"
 * table on the survey summary, and that table has nothing to show if every response is complete.
 */
async function seedResponses(surveyId: string, finishedCount: number, partialCount: number): Promise<void> {
  await prisma.response.deleteMany({ where: { surveyId } });

  const ordered = ACME_ELEMENTS.map((e) => e.id);

  const total = finishedCount + partialCount;
  // Interleave rather than writing all the finished ones first. The response table sorts newest
  // first, so a contiguous block of partials at the end lands at the *top* of the screenshot and
  // makes the product look like nothing ever completes. Spreading them by rank rather than by a
  // fixed modulus is what keeps the counts equal to the arguments for any pair of them.
  const partialRows = new Set<number>();
  for (let k = 0; k < partialCount; k++) {
    partialRows.add(Math.floor(((k + 0.5) * total) / partialCount));
  }

  for (let i = 0; i < total; i++) {
    const finished = !partialRows.has(i);
    // A partial stops somewhere in the first half, which is what makes the drop-off curve a curve.
    const answeredUpTo = finished ? ordered.length : 2 + (i % 5);

    const data: Record<string, unknown> = {};
    for (const id of ordered.slice(0, answeredUpTo)) {
      const pool = ANSWER_POOL[id];
      if (pool) data[id] = pick(pool, i);
    }

    // Hidden field values ride in the same `data` map as answers, keyed by field id. Seeded because
    // `hidden-fields.mdx` documents reading them back in the response table, and empty columns show
    // the reader nothing.
    const campaign = pick(["newsletter", "google", "branch-flyer", "partner-site"], i);
    const tier = pick(["basic", "plus", "premium"], i);
    Object.assign(data, {
      utm_source: campaign,
      plan_tier: tier,
      branch_code: `BR-${String(100 + (i % 7))}`,
      referral_code: i % 3 === 0 ? `ACME-${String(2000 + i)}` : "",
    });

    const display = await prisma.display.create({ data: { surveyId } });
    await prisma.response.create({
      data: {
        surveyId,
        finished,
        data: data as never,
        meta: pick(RESPONSE_META, i) as never,
        displayId: display.id,
      },
    });
  }
}

/**
 * Hidden fields and variables the docs pages photograph.
 *
 * Populated rather than left empty: `hidden-fields.mdx` and `variables.mdx` are about configuring
 * these, and an empty-state screenshot ("No hidden fields yet") shows the reader nothing they came
 * for. Names are ACME's — a bank passing campaign and tier context into a survey.
 */
const ACME_HIDDEN_FIELDS = {
  enabled: true,
  fieldIds: ["utm_source", "plan_tier", "branch_code", "referral_code"],
};

const ACME_VARIABLES = [
  { id: createId(), name: "applicant_score", type: "number" as const, value: 0 },
  { id: createId(), name: "product_line", type: "text" as const, value: "retail" },
];

/**
 * Tags, applied to a share of the responses.
 *
 * `tags.mdx` documents the tag manager and its usage counts. Both are empty without this, and an
 * empty tag manager is not what the page is trying to show.
 */
const ACME_TAGS = ["churn risk", "praise", "app bug", "branch feedback", "pricing"];

async function seedTags(workspaceId: string, surveyId: string): Promise<void> {
  const responses = await prisma.response.findMany({ where: { surveyId }, select: { id: true } });

  for (const [index, name] of ACME_TAGS.entries()) {
    const tag = await prisma.tag.upsert({
      where: { workspaceId_name: { workspaceId, name } },
      update: {},
      create: { name, workspaceId },
    });

    // Uneven counts on purpose: the manager shows a usage column, and identical numbers down the
    // column look like placeholder data.
    const take = 3 + index * 4;
    for (const response of responses.slice(index, index + take)) {
      await prisma.tagsOnResponses.upsert({
        where: { responseId_tagId: { responseId: response.id, tagId: tag.id } },
        update: {},
        create: { responseId: response.id, tagId: tag.id },
      });
    }
  }
}

/**
 * ACME's contacts, with the attributes a bank would actually hold.
 *
 * The Contacts area is a top-level nav item with three screens and no documentation (ENG-2720), and
 * none of them show anything without contacts. Emails are on `example.com`, which cannot receive
 * mail, so nothing here reaches a real inbox.
 */
const ACME_CONTACTS = [
  {
    email: "rosa.alvarez@example.com",
    userId: "usr_1041",
    firstName: "Rosa",
    lastName: "Alvarez",
    plan: "premium",
    branch: "BR-100",
    segment: "Joint account",
  },
  {
    email: "t.okafor@example.com",
    userId: "usr_1042",
    firstName: "Tunde",
    lastName: "Okafor",
    plan: "plus",
    branch: "BR-101",
    segment: "Everyday checking",
  },
  {
    email: "meera.iyer@example.com",
    userId: "usr_1043",
    firstName: "Meera",
    lastName: "Iyer",
    plan: "basic",
    branch: "BR-102",
    segment: "Savings",
  },
  {
    email: "j.lindqvist@example.com",
    userId: "usr_1044",
    firstName: "Johan",
    lastName: "Lindqvist",
    plan: "premium",
    branch: "BR-103",
    segment: "Business",
  },
  {
    email: "amara.diallo@example.com",
    userId: "usr_1045",
    firstName: "Amara",
    lastName: "Diallo",
    plan: "plus",
    branch: "BR-104",
    segment: "Joint account",
  },
  {
    email: "w.nakamura@example.com",
    userId: "usr_1046",
    firstName: "Wataru",
    lastName: "Nakamura",
    plan: "basic",
    branch: "BR-105",
    segment: "Everyday checking",
  },
  {
    email: "s.oconnell@example.com",
    userId: "usr_1047",
    firstName: "Siobhan",
    lastName: "O'Connell",
    plan: "premium",
    branch: "BR-106",
    segment: "Savings",
  },
  {
    email: "d.petrov@example.com",
    userId: "usr_1048",
    firstName: "Dmitri",
    lastName: "Petrov",
    plan: "basic",
    branch: "BR-100",
    segment: "Business",
  },
];

/** `email` and `userId` are default keys the app creates itself; the rest are ACME's own. */
const CONTACT_ATTRIBUTE_KEYS = [
  { key: "email", name: "Email", type: "default" as const },
  { key: "userId", name: "User ID", type: "default" as const },
  { key: "firstName", name: "First Name", type: "default" as const },
  { key: "lastName", name: "Last Name", type: "default" as const },
  { key: "plan", name: "Plan", type: "custom" as const },
  { key: "branch", name: "Branch", type: "custom" as const },
  { key: "segment", name: "Segment", type: "custom" as const },
];

async function seedContacts(workspaceId: string): Promise<void> {
  const keyIds = new Map<string, string>();
  for (const { key, name, type } of CONTACT_ATTRIBUTE_KEYS) {
    const row = await prisma.contactAttributeKey.upsert({
      where: { key_workspaceId: { key, workspaceId } },
      update: { name },
      create: { key, name, type, workspaceId },
    });
    keyIds.set(key, row.id);
  }

  for (const person of ACME_CONTACTS) {
    // Keyed off the email attribute so re-running updates the same contact instead of adding a new one.
    const existing = await prisma.contactAttribute.findFirst({
      where: { attributeKeyId: keyIds.get("email"), value: person.email, contact: { workspaceId } },
      select: { contactId: true },
    });
    const contactId = existing?.contactId ?? (await prisma.contact.create({ data: { workspaceId } })).id;

    for (const [key, value] of Object.entries(person)) {
      const attributeKeyId = keyIds.get(key);
      if (!attributeKeyId) continue;
      await prisma.contactAttribute.upsert({
        where: { contactId_attributeKeyId: { contactId, attributeKeyId } },
        update: { value },
        create: { contactId, attributeKeyId, value },
      });
    }
  }
}

/**
 * One segment, so the Segments tab shows a segment rather than its empty state.
 *
 * Filter shape follows TBaseFilters: a list of groups, each `{ id, connector, resource }`, where the
 * first group's connector must be null. Attribute filters key off `contactAttributeKey`, which is the
 * attribute's key string, not its row id.
 */
async function seedSegment(workspaceId: string): Promise<void> {
  const filters = [
    {
      id: createId(),
      connector: null,
      resource: {
        id: createId(),
        root: { type: "attribute", contactAttributeKey: "plan" },
        qualifier: { operator: "equals" },
        value: "premium",
      },
    },
  ];

  await prisma.segment.upsert({
    where: { workspaceId_title: { workspaceId, title: "Premium account holders" } },
    update: { filters: filters as never },
    create: {
      title: "Premium account holders",
      description: "Contacts on the premium plan, for targeted follow-up.",
      isPrivate: false,
      workspaceId,
      filters: filters as never,
    },
  });
}

/**
 * A second survey, of type `app`.
 *
 * The editor hides whole sections for link surveys — Visibility & Recontact, and the targeting
 * controls — so the pages documenting those cannot be captured against the all-elements survey,
 * which is a link survey. Kept deliberately small: it exists to be photographed, not to demonstrate
 * every element type.
 */
const APP_SURVEY_ELEMENTS = [
  {
    id: "acme-app-rating",
    type: "rating",
    headline: { default: "How is the mobile app working for you?" },
    required: true,
    scale: "star",
    range: 5,
    lowerLabel: { default: "Poor" },
    upperLabel: { default: "Excellent" },
  },
  {
    id: "acme-app-openText",
    type: "openText",
    headline: { default: "What would you change about it?" },
    required: false,
    placeholder: { default: "Type your answer here..." },
    longAnswer: true,
  },
];

/**
 * The no-code and code actions an app survey can be triggered by.
 *
 * One of each type the product supports, so the User Actions list and the trigger picker both show
 * something real. An empty list is the wrong picture for a page whose whole subject is the list.
 */
async function seedActions(workspaceId: string): Promise<void> {
  const actions = [
    {
      name: "Clicked “Open a savings account”",
      description: "The primary call to action on the savings landing page.",
      type: "noCode" as const,
      noCodeConfig: {
        type: "click",
        urlFilters: [{ rule: "contains", value: "/savings" }],
        elementSelector: { innerHtml: "Open a savings account" },
      },
    },
    {
      name: "Viewed the mortgage calculator",
      description: "Any visit to the mortgage calculator page.",
      type: "noCode" as const,
      noCodeConfig: { type: "pageView", urlFilters: [{ rule: "contains", value: "/mortgage-calculator" }] },
    },
    {
      name: "About to abandon the application form",
      description: "Pointer leaves the viewport while the account application is open.",
      type: "noCode" as const,
      noCodeConfig: {
        type: "exitIntent",
        urlFilters: [{ rule: "startsWith", value: "https://acme.example.com/apply" }],
      },
    },
    {
      name: "Read half the fees page",
      description: "Scrolled 50% down the fees and charges page.",
      type: "noCode" as const,
      noCodeConfig: { type: "fiftyPercentScroll", urlFilters: [{ rule: "endsWith", value: "/fees" }] },
    },
    {
      name: "Lingered on the rates page",
      description: "Thirty seconds on the rates page without leaving.",
      type: "noCode" as const,
      noCodeConfig: {
        type: "pageDwell",
        urlFilters: [{ rule: "contains", value: "/rates" }],
        timeInSeconds: 30,
      },
    },
    {
      name: "Completed a transfer",
      description: "Fired from the app once a transfer settles.",
      type: "code" as const,
      key: "transfer_completed",
    },
  ];

  for (const action of actions) {
    await prisma.actionClass.upsert({
      where: { name_workspaceId: { name: action.name, workspaceId } },
      update: {},
      // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- noCodeConfig is a typed Json column and its union does not narrow through the spread
      create: { ...action, workspaceId } as any,
    });
  }
}

/**
 * Two small link surveys that exist only so the respondent-facing gates can be photographed.
 *
 * The PIN screen and the email gate are what a respondent meets before the survey, and neither can
 * be shown from the editor. Putting them on their own surveys keeps the main fixture untouched —
 * flipping these settings on the 16-question survey would change every other shot taken from it.
 */
async function seedGatedSurveys(workspaceId: string): Promise<void> {
  const gated = [
    {
      id: DOCS_IDS.SURVEY_PIN,
      name: "Branch visit feedback",
      pin: "1234",
      isVerifyEmailEnabled: false,
      headline: "How was your visit to the branch?",
    },
    {
      id: DOCS_IDS.SURVEY_VERIFY_EMAIL,
      name: "Quarterly account review",
      pin: null,
      isVerifyEmailEnabled: true,
      headline: "How are we doing on your account this quarter?",
    },
  ];

  for (const survey of gated) {
    const blocks = [
      {
        id: createId(),
        name: survey.name,
        elements: [
          {
            id: createId(),
            type: "rating",
            headline: { default: survey.headline },
            required: true,
            scale: "star",
            range: 5,
            lowerLabel: { default: "Poor" },
            upperLabel: { default: "Excellent" },
            isDraft: false,
          },
        ],
      },
    ] as unknown as TSurveyBlocks;

    await prisma.survey.upsert({
      where: { id: survey.id },
      update: { pin: survey.pin, isVerifyEmailEnabled: survey.isVerifyEmailEnabled, blocks },
      create: {
        id: survey.id,
        name: survey.name,
        workspaceId,
        status: "inProgress",
        type: "link",
        pin: survey.pin,
        isVerifyEmailEnabled: survey.isVerifyEmailEnabled,
        blocks,
      },
    });
  }
}

/**
 * A handful of colleagues, so the members and teams screens are not a table with one row in it.
 *
 * The addresses are on `example.com`, which is reserved by RFC 2606 and reaches nobody. Every one
 * of these people is invented; none of the names belongs to a Formbricks employee or customer.
 */
async function seedPeopleAndTeams(organizationId: string, workspaceId: string): Promise<void> {
  const people = [
    {
      id: "cldocsuser0000000000001",
      name: "Priya Raman",
      email: "priya.raman@example.com",
      role: "manager" as const,
    },
    {
      id: "cldocsuser0000000000002",
      name: "Tom Okafor",
      email: "tom.okafor@example.com",
      role: "member" as const,
    },
    {
      id: "cldocsuser0000000000003",
      name: "Lena Fischer",
      email: "lena.fischer@example.com",
      role: "member" as const,
    },
    {
      id: "cldocsuser0000000000004",
      name: "Sam Whitfield",
      email: "sam.whitfield@example.com",
      role: "billing" as const,
    },
  ];

  for (const person of people) {
    await prisma.user.upsert({
      where: { id: person.id },
      update: { name: person.name },
      create: { id: person.id, name: person.name, email: person.email, emailVerified: true },
    });
    await prisma.membership.upsert({
      where: { userId_organizationId: { userId: person.id, organizationId } },
      update: { role: person.role },
      create: { userId: person.id, organizationId, role: person.role, accepted: true },
    });
  }

  const teams = [
    { name: "Customer Research", members: [people[0].id, people[1].id], admin: people[0].id },
    { name: "Retail Product", members: [people[2].id], admin: people[2].id },
  ];

  for (const team of teams) {
    const record = await prisma.team.upsert({
      where: { organizationId_name: { organizationId, name: team.name } },
      update: {},
      create: { name: team.name, organizationId },
    });

    for (const userId of team.members) {
      await prisma.teamUser.upsert({
        where: { teamId_userId: { teamId: record.id, userId } },
        update: { role: userId === team.admin ? "admin" : "contributor" },
        create: { teamId: record.id, userId, role: userId === team.admin ? "admin" : "contributor" },
      });
    }

    await prisma.workspaceTeam.upsert({
      where: { workspaceId_teamId: { workspaceId, teamId: record.id } },
      update: {},
      create: {
        workspaceId,
        teamId: record.id,
        permission: team.name === "Customer Research" ? "readWrite" : "read",
      },
    });
  }
}

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
    update: {
      workspaceId: workspace.id,
      blocks,
      hiddenFields: ACME_HIDDEN_FIELDS as never,
      variables: ACME_VARIABLES as never,
    },
    create: {
      id: DOCS_IDS.SURVEY_ALL_ELEMENTS,
      name: "Account opening feedback",
      workspaceId: workspace.id,
      status: "inProgress",
      type: "link",
      blocks,
      hiddenFields: ACME_HIDDEN_FIELDS as never,
      variables: ACME_VARIABLES as never,
    },
  });

  const appBlocks = [
    { id: createId(), name: "Mobile app feedback", elements: APP_SURVEY_ELEMENTS },
  ] as unknown as TSurveyBlocks;

  // An app survey needs its own private segment: that is the survey's targeting audience, and the
  // editor fails to load without one ("This resource does not exist or you do not have the necessary
  // rights"). Link surveys have no targeting, which is why the other survey needs none.
  const appSegment = await prisma.segment.upsert({
    where: { workspaceId_title: { workspaceId: workspace.id, title: DOCS_IDS.SURVEY_APP } },
    update: {},
    create: { title: DOCS_IDS.SURVEY_APP, isPrivate: true, workspaceId: workspace.id, filters: [] },
  });

  await prisma.survey.upsert({
    where: { id: DOCS_IDS.SURVEY_APP },
    update: { workspaceId: workspace.id, blocks: appBlocks, segmentId: appSegment.id },
    create: {
      id: DOCS_IDS.SURVEY_APP,
      name: "Mobile app feedback",
      workspaceId: workspace.id,
      status: "inProgress",
      type: "app",
      blocks: appBlocks,
      segmentId: appSegment.id,
    },
  });

  await seedResponses(DOCS_IDS.SURVEY_ALL_ELEMENTS, 38, 14);
  await seedTags(workspace.id, DOCS_IDS.SURVEY_ALL_ELEMENTS);
  await seedContacts(workspace.id);
  await seedSegment(workspace.id);
  await seedActions(workspace.id);
  await seedGatedSurveys(workspace.id);
  await seedPeopleAndTeams(organization.id, workspace.id);

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
