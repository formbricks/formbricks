import type { TLinkedEmbeddedField } from "../../embedded-data-resolver";
import type { TSurveyBlock, TSurveyBlockLogic } from "../blocks";
import { TSurveyElementTypeEnum } from "../constants";
import type { TResponseNotShown } from "../not-shown";
import type { TSurvey } from "../types";

/**
 * The shared fixture survey of the Survey Flow Editor (ENG-6929): one survey holding every flow
 * construct the survey document accepts, so the validation, v3, Flow outline and E2E tests all check
 * "everything the API accepts renders" against the same source.
 *
 * **Extend it, don't fork it.** A ticket that adds a construct (show-if, start logic, Set value
 * expressions, Mark as low quality, copied options, hidden options, matrix ids, …) adds an example of
 * it here. `survey-flow-fixture.test.ts` reads the schema for the list of action objectives, operand
 * types, ending types and question types, and fails until this fixture holds each one.
 *
 * Content follows the UI mock ("Streaming services 2026"). Ids are fixed so tests can name them; ids
 * the schema requires to be cuid2 are lowercase alphanumerics.
 */

const i18n = (text: string) => ({ default: text });

/** Fixed ids, exported so tests can point at a construct without searching for it. */
export const SURVEY_FLOW_FIXTURE_IDS = {
  survey: "flowfixturesurvey0000001",
  workspace: "flowfixtureworkspace0001",
  blocks: {
    services: "flowblockservices0000001",
    ratings: "flowblockratings00000001",
    heavyUsers: "flowblockheavyusers00001",
    concept: "flowblockconcept00000001",
    overall: "flowblockoverall00000001",
    profile: "flowblockprofile00000001",
  },
  endings: {
    thanks: "flowendingthanks00000001",
    noBundle: "flowendingnobundle000001",
    notForYou: "flowendingnotforyou00001",
    internal: "flowendinginternal000001",
  },
  variables: {
    score: "flowvarscore000000000001",
    tenureDays: "flowvartenuredays0000001",
    segment: "flowvarsegment0000000001",
    // ENG-6935: a computed date field, set with now().
    signedUpAt: "flowvarsignedupat0000001",
  },
  /** ENG-6935: Set value steps and expression calculations, with fixed ids. */
  setValue: {
    scoreRule: "flowsetvaluescorerule0001",
    scoreGroup: "flowsetvaluescoregroup001",
    scoreAction: "flowsetvaluescoreaction01",
    hoursRule: "flowsetvaluehoursrule0001",
    hoursGroup: "flowsetvaluehoursgroup001",
    hoursCondition: "flowsetvaluehourscond0001",
    hoursAction: "flowsetvaluehoursaction01",
    segmentAction: "flowsetvaluesegaction0001",
    tenureRule: "flowsetvaluetenurerule001",
    tenureGroup: "flowsetvaluetenuregroup01",
    signedUpAction: "flowsetvaluesignedupact01",
    tenureAction: "flowsetvaluetenureact0001",
  },
  hiddenFields: {
    panelId: "panel_id",
    seg: "seg",
    signupDate: "signup_date",
    // ENG-6930: a workspace library field the survey links by key, locked.
    planTier: "plan_tier",
  },
  /** ENG-6930: the workspace library rows the survey links. */
  libraryFields: {
    planTier: "flowlibraryplantier00001",
  },
  /** ENG-6933: "If hours > 112 → Mark as low quality", the second rule of the Heavy users block. */
  lowQuality: {
    rule: "flowrulelowquality000001",
    action: "flowactionlowquality0001",
  },
} as const;

const ids = SURVEY_FLOW_FIXTURE_IDS;

// Sequential cuid2-shaped ids for rules, condition groups, conditions and actions.
let sequence = 0;
const nextId = (prefix: "rule" | "group" | "cond" | "action" | "showif"): string => {
  sequence += 1;
  return `flow${prefix}${String(sequence).padStart(24 - 4 - prefix.length, "0")}`;
};

const choice = (id: string, label: string, code: string) => ({ id, label: i18n(label), code });

/** ENG-6937: an option, row or column show-if "shown only if `elementId` includes `optionId`". */
const pickedIn = (elementId: string, optionId: string) => ({
  id: nextId("showif"),
  connector: "and" as const,
  conditions: [
    {
      id: nextId("showif"),
      leftOperand: { type: "element" as const, value: elementId },
      operator: "includesOneOf" as const,
      rightOperand: { type: "static" as const, value: [optionId] },
    },
  ],
});

const contactField = (placeholder: string) => ({
  show: true,
  required: false,
  placeholder: i18n(placeholder),
});

const embeddedFields: TLinkedEmbeddedField[] = [
  {
    field: {
      key: null,
      name: "score",
      source: "computed",
      dataType: "number",
      defaultValue: 0,
      locked: false,
    },
    link: { storageKey: ids.variables.score },
  },
  {
    field: {
      key: null,
      name: "tenure_days",
      source: "computed",
      dataType: "number",
      defaultValue: 0,
      locked: false,
    },
    link: { storageKey: ids.variables.tenureDays },
  },
  {
    field: {
      key: null,
      name: "segment",
      source: "computed",
      dataType: "string",
      defaultValue: "",
      locked: false,
    },
    link: { storageKey: ids.variables.segment },
  },
  // ENG-6935: a computed date. Not in the legacy `variables` (json-shapes §6).
  {
    field: {
      key: null,
      name: "signed_up_at",
      source: "computed",
      dataType: "date",
      defaultValue: null,
      locked: false,
    },
    link: { storageKey: ids.variables.signedUpAt },
  },
  {
    field: {
      key: null,
      name: "panel_id",
      source: "ingested",
      dataType: "string",
      defaultValue: null,
      locked: false,
    },
    link: { storageKey: ids.hiddenFields.panelId },
  },
  {
    field: {
      key: null,
      name: "seg",
      source: "ingested",
      dataType: "string",
      defaultValue: null,
      locked: false,
    },
    link: { storageKey: ids.hiddenFields.seg },
  },
  {
    field: {
      key: null,
      name: "signup_date",
      source: "ingested",
      dataType: "date",
      defaultValue: null,
      locked: false,
    },
    link: { storageKey: ids.hiddenFields.signupDate },
  },
  // ENG-6930: linked from the workspace library (`key` set, `id` naming the library row), and locked.
  {
    field: {
      id: ids.libraryFields.planTier,
      key: "plan_tier",
      name: "Plan tier",
      source: "ingested",
      dataType: "string",
      defaultValue: "free",
      locked: true,
    },
    link: { storageKey: ids.hiddenFields.planTier },
  },
];

const servicesBlock: TSurveyBlock = {
  id: ids.blocks.services,
  name: "Services",
  elements: [
    {
      id: "services",
      code: "services",
      type: TSurveyElementTypeEnum.MultipleChoiceMulti,
      headline: i18n("Which streaming services do you use?"),
      required: true,
      shuffleOption: "all",
      choices: [
        choice("netflix", "Netflix", "1"),
        choice("disney", "Disney+", "2"),
        choice("prime", "Prime Video", "3"),
        choice("apple", "Apple TV+", "4"),
      ],
    },
  ],
  logic: [
    // Require answer, from an answer and an ingested field.
    {
      id: nextId("rule"),
      conditions: {
        id: nextId("group"),
        connector: "and",
        conditions: [
          {
            id: nextId("cond"),
            leftOperand: { type: "element", value: "services" },
            operator: "includesOneOf",
            rightOperand: { type: "static", value: ["apple"] },
          },
          {
            id: nextId("cond"),
            leftOperand: { type: "hiddenField", value: ids.hiddenFields.panelId },
            operator: "isSet",
          },
        ],
      },
      actions: [{ id: nextId("action"), objective: "requireAnswer", target: "apple_reason" }],
    },
    // Calculation: add a fixed number.
    {
      id: nextId("rule"),
      conditions: {
        id: nextId("group"),
        connector: "and",
        conditions: [
          {
            id: nextId("cond"),
            leftOperand: { type: "element", value: "services" },
            operator: "includesAllOf",
            rightOperand: { type: "static", value: ["netflix", "disney"] },
          },
        ],
      },
      actions: [
        {
          id: nextId("action"),
          objective: "calculate",
          variableId: ids.variables.score,
          operator: "add",
          value: { type: "static", value: 1 },
        },
      ],
    },
  ],
};

const ratingsBlock: TSurveyBlock = {
  id: ids.blocks.ratings,
  name: "Ratings",
  elements: [
    {
      id: "sat_netflix",
      code: "sat_netflix",
      type: TSurveyElementTypeEnum.Rating,
      headline: i18n("How satisfied are you with Netflix?"),
      required: false,
      scale: "number",
      range: 5,
      isColorCodingEnabled: false,
    },
    {
      id: "sat_disney",
      code: "sat_disney",
      type: TSurveyElementTypeEnum.Rating,
      headline: i18n("How satisfied are you with Disney+?"),
      required: false,
      scale: "star",
      range: 5,
      isColorCodingEnabled: false,
    },
  ],
  logic: [
    // A nested OR group, and a calculation from an answer.
    {
      id: nextId("rule"),
      conditions: {
        id: nextId("group"),
        connector: "and",
        conditions: [
          {
            id: nextId("group"),
            connector: "or",
            conditions: [
              {
                id: nextId("cond"),
                leftOperand: { type: "element", value: "sat_netflix" },
                operator: "isGreaterThan",
                rightOperand: { type: "static", value: 4 },
              },
              {
                id: nextId("cond"),
                leftOperand: { type: "element", value: "sat_disney" },
                operator: "isGreaterThan",
                rightOperand: { type: "static", value: 4 },
              },
            ],
          },
        ],
      },
      actions: [
        {
          id: nextId("action"),
          objective: "calculate",
          variableId: ids.variables.score,
          operator: "add",
          value: { type: "element", value: "sat_netflix" },
        },
      ],
    },
  ],
};

const heavyUsersBlock: TSurveyBlock = {
  id: ids.blocks.heavyUsers,
  name: "Heavy users",
  // Block show-if (ENG-6931), on an earlier block's answer: only people using all three big services.
  showIf: {
    id: nextId("showif"),
    connector: "and",
    conditions: [
      {
        id: nextId("showif"),
        leftOperand: { type: "element", value: "services" },
        operator: "includesAllOf",
        rightOperand: { type: "static", value: ["netflix", "disney", "prime"] },
      },
    ],
  },
  elements: [
    {
      id: "hours",
      code: "hours",
      type: TSurveyElementTypeEnum.OpenText,
      headline: i18n("How many hours a week do you stream?"),
      required: false,
      inputType: "number",
      charLimit: { enabled: false },
    },
  ],
  logic: [
    // A right operand that is another answer, and a calculation from a computed field.
    {
      id: nextId("rule"),
      conditions: {
        id: nextId("group"),
        connector: "or",
        conditions: [
          {
            id: nextId("cond"),
            leftOperand: { type: "element", value: "hours" },
            operator: "isGreaterThanOrEqual",
            rightOperand: { type: "static", value: 20 },
          },
          {
            id: nextId("cond"),
            leftOperand: { type: "variable", value: ids.variables.tenureDays },
            operator: "isLessThan",
            rightOperand: { type: "element", value: "hours" },
          },
        ],
      },
      actions: [
        {
          id: nextId("action"),
          objective: "calculate",
          variableId: ids.variables.segment,
          operator: "concat",
          value: { type: "static", value: "-heavy" },
        },
        {
          id: nextId("action"),
          objective: "calculate",
          variableId: ids.variables.score,
          operator: "subtract",
          value: { type: "variable", value: ids.variables.tenureDays },
        },
      ],
    },
    // Mark as low quality (ENG-6933): an implausible answer marks the response, and the respondent
    // carries on. Fixed ids, so adding it shifts none of the generated ones after it.
    {
      id: ids.lowQuality.rule,
      conditions: {
        id: "flowgrouplowquality00001",
        connector: "and",
        conditions: [
          {
            id: "flowcondlowquality000001",
            leftOperand: { type: "element", value: "hours" },
            operator: "isGreaterThan",
            rightOperand: { type: "static", value: 112 },
          },
        ],
      },
      actions: [{ id: ids.lowQuality.action, objective: "markLowQuality" }],
    },
  ],
};

const conceptBlock: TSurveyBlock = {
  id: ids.blocks.concept,
  name: "Concept",
  elements: [
    {
      id: "concept",
      code: "concept",
      type: TSurveyElementTypeEnum.NPS,
      headline: i18n("How likely would you buy the Netflix + Disney+ bundle?"),
      required: false,
      isColorCodingEnabled: false,
    },
  ],
  logic: [
    {
      id: nextId("rule"),
      conditions: {
        id: nextId("group"),
        connector: "and",
        conditions: [
          {
            id: nextId("cond"),
            leftOperand: { type: "element", value: "concept" },
            operator: "isGreaterThanOrEqual",
            rightOperand: { type: "static", value: 9 },
          },
        ],
      },
      actions: [
        {
          id: nextId("action"),
          objective: "calculate",
          variableId: ids.variables.score,
          operator: "multiply",
          value: { type: "static", value: 2 },
        },
      ],
    },
    {
      id: nextId("rule"),
      conditions: {
        id: nextId("group"),
        connector: "and",
        conditions: [
          {
            id: nextId("cond"),
            leftOperand: { type: "element", value: "concept" },
            operator: "isLessThan",
            rightOperand: { type: "static", value: 5 },
          },
        ],
      },
      actions: [
        {
          id: nextId("action"),
          objective: "calculate",
          variableId: ids.variables.score,
          operator: "divide",
          value: { type: "static", value: 2 },
        },
      ],
    },
    // A reserved field on the left, an ingested field on the right, and a calculation from each.
    {
      id: nextId("rule"),
      conditions: {
        id: nextId("group"),
        connector: "and",
        conditions: [
          {
            id: nextId("cond"),
            leftOperand: { type: "reserved", value: "language" },
            operator: "equals",
            rightOperand: { type: "hiddenField", value: ids.hiddenFields.seg },
          },
          {
            id: nextId("cond"),
            leftOperand: { type: "hiddenField", value: ids.hiddenFields.seg },
            operator: "doesNotEqual",
            rightOperand: { type: "reserved", value: "country" },
          },
        ],
      },
      actions: [
        {
          id: nextId("action"),
          objective: "calculate",
          variableId: ids.variables.segment,
          operator: "assign",
          value: { type: "hiddenField", value: ids.hiddenFields.seg },
        },
        {
          id: nextId("action"),
          objective: "calculate",
          variableId: ids.variables.segment,
          operator: "concat",
          value: { type: "reserved", value: "country" },
        },
      ],
    },
  ],
};

const overallBlock: TSurveyBlock = {
  id: ids.blocks.overall,
  name: "Overall",
  elements: [
    {
      id: "fav",
      code: "fav",
      type: TSurveyElementTypeEnum.MultipleChoiceSingle,
      headline: i18n("Which one would you miss the most?"),
      required: false,
      choices: [
        choice("netflix", "Netflix", "1"),
        choice("disney", "Disney+", "2"),
        choice("prime", "Prime Video", "3"),
        // ENG-6937: option show-if on a single select, from an earlier block.
        { ...choice("apple", "Apple TV+", "4"), showIf: pickedIn("services", "apple") },
      ],
    },
    {
      id: "apple_reason",
      code: "apple_reason",
      type: TSurveyElementTypeEnum.OpenText,
      headline: i18n("What would convince you to try Apple TV+?"),
      required: false,
      // Question show-if (ENG-6931) on the question above it on the same page, shown live.
      showIf: {
        id: nextId("showif"),
        connector: "and",
        conditions: [
          {
            id: nextId("showif"),
            leftOperand: { type: "element", value: "fav" },
            operator: "equals",
            rightOperand: { type: "static", value: "apple" },
          },
        ],
      },
      inputType: "text",
      charLimit: { enabled: false },
    },
    {
      id: "bundle",
      code: "bundle",
      type: TSurveyElementTypeEnum.MultipleChoiceSingle,
      headline: i18n("Which bundle would you pay for?"),
      required: false,
      choices: [
        choice("netflix_disney", "Netflix + Disney+", "1"),
        choice("netflix_prime", "Netflix + Prime Video", "2"),
        choice("no_bundle", "No bundle", "3"),
        // ENG-6937: a Hidden option, retired on the live survey. It wins over its show-if.
        {
          ...choice("netflix_apple", "Netflix + Apple TV+", "4"),
          hidden: true,
          showIf: {
            id: nextId("showif"),
            connector: "and",
            conditions: [
              {
                id: nextId("showif"),
                leftOperand: { type: "element", value: "fav" },
                operator: "equals",
                rightOperand: { type: "static", value: "apple" },
              },
            ],
          },
        },
      ],
    },
    {
      id: "email",
      code: "email",
      type: TSurveyElementTypeEnum.OpenText,
      headline: i18n("Where should we send the results?"),
      required: false,
      inputType: "email",
      charLimit: { enabled: false },
    },
  ],
  logic: [
    {
      id: nextId("rule"),
      conditions: {
        id: nextId("group"),
        connector: "and",
        conditions: [
          {
            id: nextId("cond"),
            leftOperand: { type: "element", value: "fav" },
            operator: "equalsOneOf",
            rightOperand: { type: "static", value: ["netflix", "disney"] },
          },
        ],
      },
      actions: [
        {
          id: nextId("action"),
          objective: "calculate",
          variableId: ids.variables.segment,
          operator: "concat",
          value: { type: "static", value: "-core" },
        },
      ],
    },
    // Jump to an ending, behind a nested OR group.
    {
      id: nextId("rule"),
      conditions: {
        id: nextId("group"),
        connector: "and",
        conditions: [
          {
            id: nextId("cond"),
            leftOperand: { type: "element", value: "bundle" },
            operator: "equals",
            rightOperand: { type: "static", value: "no_bundle" },
          },
          {
            id: nextId("group"),
            connector: "or",
            conditions: [
              {
                id: nextId("cond"),
                leftOperand: { type: "element", value: "apple_reason" },
                operator: "isSkipped",
              },
              {
                id: nextId("cond"),
                leftOperand: { type: "element", value: "apple_reason" },
                operator: "contains",
                rightOperand: { type: "static", value: "price" },
              },
            ],
          },
        ],
      },
      actions: [{ id: nextId("action"), objective: "jumpToBlock", target: ids.endings.noBundle }],
    },
    // Jump to a redirect ending.
    {
      id: nextId("rule"),
      conditions: {
        id: nextId("group"),
        connector: "and",
        conditions: [
          {
            id: nextId("cond"),
            leftOperand: { type: "element", value: "email" },
            operator: "isSubmitted",
          },
          {
            id: nextId("cond"),
            leftOperand: { type: "element", value: "email" },
            operator: "endsWith",
            rightOperand: { type: "static", value: "@nielseniq.com" },
          },
        ],
      },
      actions: [{ id: nextId("action"), objective: "jumpToBlock", target: ids.endings.internal }],
    },
    // Several actions: assign a fixed value and a computed field, then jump to a later block.
    {
      id: nextId("rule"),
      conditions: {
        id: nextId("group"),
        connector: "and",
        conditions: [
          {
            id: nextId("cond"),
            leftOperand: { type: "element", value: "bundle" },
            operator: "doesNotEqual",
            rightOperand: { type: "static", value: "no_bundle" },
          },
          {
            id: nextId("cond"),
            leftOperand: { type: "variable", value: ids.variables.score },
            operator: "isGreaterThan",
            rightOperand: { type: "variable", value: ids.variables.tenureDays },
          },
        ],
      },
      actions: [
        {
          id: nextId("action"),
          objective: "calculate",
          variableId: ids.variables.segment,
          operator: "assign",
          value: { type: "static", value: "hot-lead" },
        },
        {
          id: nextId("action"),
          objective: "calculate",
          variableId: ids.variables.tenureDays,
          operator: "assign",
          value: { type: "variable", value: ids.variables.score },
        },
        { id: nextId("action"), objective: "jumpToBlock", target: ids.blocks.profile },
      ],
    },
  ],
  logicFallback: ids.endings.thanks,
};

const profileBlock: TSurveyBlock = {
  id: ids.blocks.profile,
  name: "Profile",
  elements: [
    {
      id: "csat",
      code: "csat",
      type: TSurveyElementTypeEnum.CSAT,
      headline: i18n("How satisfied are you with your streaming setup?"),
      required: false,
      scale: "smiley",
      range: 5,
      isColorCodingEnabled: false,
    },
    {
      id: "ces",
      code: "ces",
      type: TSurveyElementTypeEnum.CES,
      headline: i18n("How easy was it to find something to watch?"),
      required: false,
      scale: "number",
      range: 7,
      isColorCodingEnabled: false,
    },
    {
      id: "brand_grid",
      code: "brand_grid",
      type: TSurveyElementTypeEnum.Matrix,
      headline: i18n("How do you rate each service?"),
      required: false,
      shuffleOption: "none",
      // ENG-6937: a row shown only to who uses the service. (Two columns only: ENG-6934's tests reverse
      // them to check that conditions follow column ids.)
      rows: [
        choice("row_netflix", "Netflix", "1"),
        { ...choice("row_disney", "Disney+", "2"), showIf: pickedIn("services", "disney") },
      ],
      columns: [choice("col_poor", "Poor", "1"), choice("col_good", "Good", "2")],
    },
    {
      id: "brand_rank",
      code: "brand_rank",
      type: TSurveyElementTypeEnum.Ranking,
      headline: i18n("Rank the services you use"),
      required: false,
      choices: [
        choice("netflix", "Netflix", "1"),
        choice("disney", "Disney+", "2"),
        // ENG-6937: option show-if on a ranking.
        { ...choice("prime", "Prime Video", "3"), showIf: pickedIn("services", "prime") },
      ],
    },
    {
      id: "ad_pick",
      code: "ad_pick",
      type: TSurveyElementTypeEnum.PictureSelection,
      headline: i18n("Which poster would make you click?"),
      required: false,
      allowMulti: false,
      choices: [
        { id: "poster_a", code: "1", imageUrl: "https://example.com/poster-a.png" },
        // ENG-6937: option show-if on a picture choice, from a question above it on the same page.
        {
          id: "poster_b",
          code: "2",
          imageUrl: "https://example.com/poster-b.png",
          showIf: {
            id: nextId("showif"),
            connector: "and",
            conditions: [
              {
                id: nextId("showif"),
                leftOperand: { type: "element", value: "brand_rank" },
                operator: "isSubmitted",
              },
            ],
          },
        },
      ],
    },
    {
      id: "last_purchase",
      code: "last_purchase",
      type: TSurveyElementTypeEnum.Date,
      headline: i18n("When did you last subscribe to a service?"),
      required: false,
      format: "y-M-d",
    },
    {
      id: "receipt",
      code: "receipt",
      type: TSurveyElementTypeEnum.FileUpload,
      headline: i18n("Upload your latest invoice"),
      required: false,
      allowMultipleFiles: false,
    },
    {
      id: "consent",
      code: "consent",
      type: TSurveyElementTypeEnum.Consent,
      headline: i18n("May we contact you about this study?"),
      label: i18n("Yes, you may contact me"),
      required: false,
    },
    {
      id: "learn_more",
      type: TSurveyElementTypeEnum.CTA,
      headline: i18n("Read about our panel"),
      required: false,
      buttonExternal: false,
    },
    {
      id: "address",
      code: "address",
      type: TSurveyElementTypeEnum.Address,
      headline: i18n("Where do you live?"),
      required: false,
      addressLine1: contactField("Address line 1"),
      addressLine2: contactField("Address line 2"),
      city: contactField("City"),
      state: contactField("State"),
      zip: contactField("Zip"),
      country: contactField("Country"),
    },
    {
      id: "contact",
      code: "contact",
      type: TSurveyElementTypeEnum.ContactInfo,
      headline: i18n("How can we reach you?"),
      required: false,
      firstName: contactField("First name"),
      lastName: contactField("Last name"),
      email: contactField("Email"),
      phone: contactField("Phone"),
      company: contactField("Company"),
    },
    {
      id: "interview",
      code: "interview",
      type: TSurveyElementTypeEnum.Cal,
      headline: i18n("Book a follow-up interview"),
      required: false,
      calUserName: "rick/get-rick-rolled",
    },
    {
      // ENG-6938: copied options. The services keep their ids and codes from "services", each shown
      // only if it was picked there; "None of these" is a fixed option with the next code free in both.
      id: "recommend",
      code: "recommend",
      type: TSurveyElementTypeEnum.MultipleChoiceMulti,
      headline: i18n("Which services would you recommend to a friend?"),
      required: false,
      optionsCopiedFrom: "services",
      choices: [
        { ...choice("netflix", "Netflix", "1"), showIf: pickedIn("services", "netflix") },
        { ...choice("disney", "Disney+", "2"), showIf: pickedIn("services", "disney") },
        { ...choice("prime", "Prime Video", "3"), showIf: pickedIn("services", "prime") },
        { ...choice("apple", "Apple TV+", "4"), showIf: pickedIn("services", "apple") },
        choice("none", "None of these", "5"),
      ],
    },
  ],
  logic: [
    // A matrix row condition (ENG-6934: row and column ids next to the positions row 0, column 1)
    // and a date condition.
    {
      id: nextId("rule"),
      conditions: {
        id: nextId("group"),
        connector: "and",
        conditions: [
          {
            id: nextId("cond"),
            leftOperand: { type: "element", value: "brand_grid", meta: { row: "0", rowId: "row_netflix" } },
            operator: "equals",
            rightOperand: { type: "static", value: "1", columnId: "col_good" },
          },
          {
            id: nextId("cond"),
            leftOperand: { type: "element", value: "last_purchase" },
            operator: "isBefore",
            rightOperand: { type: "static", value: "2026-01-01" },
          },
        ],
      },
      actions: [
        {
          id: nextId("action"),
          objective: "calculate",
          variableId: ids.variables.segment,
          operator: "concat",
          value: { type: "static", value: "-lapsed" },
        },
      ],
    },
  ],
};

// ENG-6935: Set value with expressions (ADR 0024, 0025). Kept apart from the blocks above and given
// fixed ids, so the sequential ids of the earlier rules don't move.
const always = (id: string) => ({ id, connector: "and" as const, conditions: [] });
const answer = (elementId: string) => ({ type: "element" as const, value: elementId });
const num = (value: number) => ({ type: "static" as const, value });

/** An always-run Set value step: score = round(ifEmpty(sat_netflix, 0) + ifEmpty(sat_disney, 0) * 2, 1). */
const scoreStep: TSurveyBlockLogic = {
  id: ids.setValue.scoreRule,
  conditions: always(ids.setValue.scoreGroup),
  actions: [
    {
      id: ids.setValue.scoreAction,
      objective: "calculate",
      variableId: ids.variables.score,
      operator: "assign",
      value: {
        type: "expression",
        value: {
          type: "call",
          fn: "round",
          args: [
            {
              type: "call",
              fn: "add",
              args: [
                { type: "call", fn: "ifEmpty", args: [answer("sat_netflix"), num(0)] },
                {
                  type: "call",
                  fn: "multiply",
                  args: [{ type: "call", fn: "ifEmpty", args: [answer("sat_disney"), num(0)] }, num(2)],
                },
              ],
            },
            num(1),
          ],
        },
      },
    },
  ],
};

/**
 * A conditional calculation: when hours > 20, score = max(min(abs(hours − 40), 100), hours ÷ 2), and
 * segment = concat("heavy-", fav), where `fav` (a single select) yields its answer code.
 */
const hoursCalculation: TSurveyBlockLogic = {
  id: ids.setValue.hoursRule,
  conditions: {
    id: ids.setValue.hoursGroup,
    connector: "and",
    conditions: [
      {
        id: ids.setValue.hoursCondition,
        leftOperand: answer("hours"),
        operator: "isGreaterThan",
        rightOperand: { type: "static", value: 20 },
      },
    ],
  },
  actions: [
    {
      id: ids.setValue.hoursAction,
      objective: "calculate",
      variableId: ids.variables.score,
      operator: "assign",
      value: {
        type: "expression",
        value: {
          type: "call",
          fn: "max",
          args: [
            {
              type: "call",
              fn: "min",
              args: [
                {
                  type: "call",
                  fn: "abs",
                  args: [{ type: "call", fn: "subtract", args: [answer("hours"), num(40)] }],
                },
                num(100),
              ],
            },
            { type: "call", fn: "divide", args: [answer("hours"), num(2)] },
          ],
        },
      },
    },
    {
      id: ids.setValue.segmentAction,
      objective: "calculate",
      variableId: ids.variables.segment,
      operator: "assign",
      value: {
        type: "expression",
        value: { type: "call", fn: "concat", args: [{ type: "static", value: "heavy-" }, answer("fav")] },
      },
    },
  ],
};

/** signed_up_at = now(), then tenure_days = daysBetween(@signup_date, signed_up_at). */
const tenureStep: TSurveyBlockLogic = {
  id: ids.setValue.tenureRule,
  conditions: always(ids.setValue.tenureGroup),
  actions: [
    {
      id: ids.setValue.signedUpAction,
      objective: "calculate",
      variableId: ids.variables.signedUpAt,
      operator: "assign",
      value: { type: "expression", value: { type: "call", fn: "now", args: [] } },
    },
    {
      id: ids.setValue.tenureAction,
      objective: "calculate",
      variableId: ids.variables.tenureDays,
      operator: "assign",
      value: {
        type: "expression",
        value: {
          type: "call",
          fn: "daysBetween",
          args: [
            { type: "hiddenField", value: ids.hiddenFields.signupDate },
            { type: "variable", value: ids.variables.signedUpAt },
          ],
        },
      },
    },
  ],
};

const withRules = (block: TSurveyBlock, rules: TSurveyBlockLogic[]): TSurveyBlock => ({
  ...block,
  logic: [...(block.logic ?? []), ...rules],
});

const blocks: TSurveyBlock[] = [
  servicesBlock,
  withRules(ratingsBlock, [scoreStep]),
  withRules(heavyUsersBlock, [hoursCalculation]),
  conceptBlock,
  overallBlock,
  withRules(profileBlock, [tenureStep]),
];

/**
 * Rules before the first question (ENG-6932), in the shape of json-shapes.md section 4: a screen-out
 * on a missing panel id, a jump with a Set value from a URL parameter, and a Set value on a reserved
 * field. Defined after the blocks so the sequential ids of the block rules above do not shift.
 */
const startLogic: TSurveyBlockLogic[] = [
  {
    id: nextId("rule"),
    conditions: {
      id: nextId("group"),
      connector: "and",
      conditions: [
        {
          id: nextId("cond"),
          leftOperand: { type: "hiddenField", value: ids.hiddenFields.panelId },
          operator: "isNotSet",
        },
      ],
    },
    actions: [{ id: nextId("action"), objective: "jumpToBlock", target: ids.endings.notForYou }],
  },
  {
    id: nextId("rule"),
    conditions: {
      id: nextId("group"),
      connector: "and",
      conditions: [
        {
          id: nextId("cond"),
          leftOperand: { type: "hiddenField", value: ids.hiddenFields.seg },
          operator: "equals",
          rightOperand: { type: "static", value: "heavy" },
        },
      ],
    },
    actions: [
      {
        id: nextId("action"),
        objective: "calculate",
        variableId: ids.variables.segment,
        operator: "assign",
        value: { type: "hiddenField", value: ids.hiddenFields.seg },
      },
      { id: nextId("action"), objective: "jumpToBlock", target: ids.blocks.heavyUsers },
    ],
  },
  {
    id: nextId("rule"),
    conditions: {
      id: nextId("group"),
      connector: "and",
      conditions: [
        {
          id: nextId("cond"),
          leftOperand: { type: "reserved", value: "url" },
          operator: "contains",
          rightOperand: { type: "static", value: "preview" },
        },
      ],
    },
    actions: [
      {
        id: nextId("action"),
        objective: "calculate",
        variableId: ids.variables.segment,
        operator: "concat",
        value: { type: "static", value: "-preview" },
      },
    ],
  },
];

export const surveyFlowFixture: TSurvey = {
  id: ids.survey,
  createdAt: new Date("2026-11-03T00:00:00.000Z"),
  updatedAt: new Date("2026-11-03T00:00:00.000Z"),
  name: "Streaming services 2026",
  type: "link",
  workspaceId: ids.workspace,
  createdBy: null,
  visibility: "workspace",
  ownerId: null,
  visibilityVersion: 0,
  visibilityProjectedVersion: 0,
  visibilityChangedAt: null,
  visibilityChangedById: null,
  status: "draft",
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [],
  recontactDays: null,
  displayLimit: null,
  welcomeCard: {
    enabled: true,
    headline: i18n("Tell us how you stream"),
    timeToFinish: true,
    showResponseCount: false,
  },
  questions: [],
  startLogic,
  blocks,
  endings: [
    { id: ids.endings.thanks, type: "endScreen", headline: i18n("Thanks for your feedback!") },
    { id: ids.endings.noBundle, type: "endScreen", headline: i18n("Good to know bundles aren't for you") },
    { id: ids.endings.notForYou, type: "endScreen", headline: i18n("Thanks — this survey isn't for you") },
    {
      id: ids.endings.internal,
      type: "redirectToUrl",
      url: "https://example.com/internal",
      label: "Internal test",
    },
  ],
  hiddenFields: {
    enabled: true,
    fieldIds: [
      ids.hiddenFields.panelId,
      ids.hiddenFields.seg,
      ids.hiddenFields.signupDate,
      ids.hiddenFields.planTier,
    ],
  },
  embeddedFields,
  variables: [
    { id: ids.variables.score, name: "score", type: "number", value: 0 },
    { id: ids.variables.tenureDays, name: "tenure_days", type: "number", value: 0 },
    { id: ids.variables.segment, name: "segment", type: "text", value: "" },
  ],
  followUps: [],
  delay: 0,
  publishOn: null,
  closeOn: null,
  autoComplete: null,
  workspaceOverwrites: null,
  styling: null,
  showLanguageSwitch: null,
  surveyClosedMessage: null,
  segment: null,
  singleUse: null,
  isVerifyEmailEnabled: false,
  recaptcha: null,
  isBackButtonHidden: false,
  isAutoProgressingEnabled: false,
  isCaptureIpEnabled: false,
  isAnonymizeResponsesEnabled: false,
  pin: null,
  displayPercentage: null,
  languages: [],
  metadata: {},
  slug: null,
};

/** Every rule of the fixture, with where it lives — a convenience for tests that walk them all. */
export const getSurveyFlowFixtureRules = (): { blockId: string; rule: TSurveyBlockLogic }[] =>
  surveyFlowFixture.blocks.flatMap((block) =>
    (block.logic ?? []).map((rule) => ({ blockId: block.id, rule }))
  );

/**
 * ENG-6936: the not-shown record of a respondent who uses Netflix only and would miss Netflix most —
 * the "Heavy users" block's show-if fails, and "What would convince you to try Apple TV+?" stays
 * hidden on the Overall page. What the survey sends with that respondent's updates.
 *
 * ENG-6937: on the same page, "Apple TV+" is not offered in "Which one would you miss the most?" (its
 * show-if needs Apple TV+ among the services), and the Hidden bundle option is never offered.
 */
export const surveyFlowFixtureNotShown: TResponseNotShown = {
  blocks: [ids.blocks.heavyUsers],
  elements: ["apple_reason"],
  options: { fav: ["apple"], bundle: ["netflix_apple"] },
};
