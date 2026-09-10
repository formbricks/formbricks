import type { TActionClass } from "@formbricks/types/action-classes";
import type { TSurvey } from "@formbricks/types/surveys/types";

/**
 * Stored-survey fixtures for the export/import round trip. Every shape is the internal one the survey
 * service returns (`{ default, "de-DE" }` locale maps), not the public v3 shape.
 */
export const FIXTURE_WORKSPACE_ID = "clxx1234567890123456789012";
export const FIXTURE_SURVEY_ID = "clsv1234567890123456789012";
export const FIXTURE_BLOCK_1_ID = "clbk0000000000000000000001";
export const FIXTURE_BLOCK_2_ID = "clbk0000000000000000000002";
export const FIXTURE_BLOCK_3_ID = "clbk0000000000000000000003";
export const FIXTURE_ENDING_ID = "clen0000000000000000000001";
export const FIXTURE_VARIABLE_ID = "clva0000000000000000000001";

const fixtureDate = new Date("2026-09-01T10:00:00.000Z");

const i18n = (en: string, de: string) => ({ default: en, "de-DE": de });

const toggleInput = (label: string) => ({
  show: true,
  required: false,
  placeholder: i18n(label, `${label} (DE)`),
});

export const FIXTURE_LANGUAGES: TSurvey["languages"] = [
  {
    default: true,
    enabled: true,
    language: {
      id: "cllangenus000000000000000",
      code: "en-US",
      alias: null,
      workspaceId: FIXTURE_WORKSPACE_ID,
      createdAt: fixtureDate,
      updatedAt: fixtureDate,
    },
  },
  {
    default: false,
    enabled: true,
    language: {
      id: "cllangdede000000000000000",
      code: "de-DE",
      alias: "german",
      workspaceId: FIXTURE_WORKSPACE_ID,
      createdAt: fixtureDate,
      updatedAt: fixtureDate,
    },
  },
];

/** One element of every type the v3 document supports, across three blocks. */
export const FIXTURE_BLOCKS = [
  {
    id: FIXTURE_BLOCK_1_ID,
    name: "Basics",
    buttonLabel: i18n("Next", "Weiter"),
    elements: [
      {
        id: "q_open",
        type: "openText",
        headline: i18n("What should we improve?", "Was sollen wir verbessern?"),
        subheader: i18n("Be specific", "Sei konkret"),
        placeholder: i18n("Type here", "Hier tippen"),
        required: true,
        inputType: "text",
        longAnswer: true,
        charLimit: { enabled: false },
      },
      {
        id: "q_nps",
        type: "nps",
        headline: i18n("How likely are you to recommend us?", "Wie wahrscheinlich empfehlen Sie uns?"),
        lowerLabel: i18n("Not likely", "Unwahrscheinlich"),
        upperLabel: i18n("Very likely", "Sehr wahrscheinlich"),
        required: true,
        isColorCodingEnabled: false,
      },
      {
        id: "q_single",
        type: "multipleChoiceSingle",
        headline: i18n("Pick one", "Wähle eins"),
        required: false,
        choices: [
          { id: "c_a", label: i18n("A", "A") },
          { id: "c_b", label: i18n("B", "B") },
          { id: "other", label: i18n("Other", "Andere") },
        ],
        otherOptionPlaceholder: i18n("Please specify", "Bitte angeben"),
        shuffleOption: "none",
      },
      {
        id: "q_multi",
        type: "multipleChoiceMulti",
        headline: i18n("Pick many", "Wähle mehrere"),
        required: false,
        choices: [
          { id: "m_a", label: i18n("One", "Eins") },
          { id: "m_b", label: i18n("Two", "Zwei") },
        ],
      },
      {
        id: "q_consent",
        type: "consent",
        headline: i18n("Terms", "Bedingungen"),
        label: i18n("I agree", "Ich stimme zu"),
        required: true,
      },
      {
        id: "q_cta",
        type: "cta",
        headline: i18n("Read on", "Weiterlesen"),
        required: false,
        buttonExternal: false,
        ctaButtonLabel: i18n("Next", "Weiter"),
      },
    ],
    logic: [
      {
        id: "cllg0000000000000000000001",
        conditions: {
          id: "clcg0000000000000000000001",
          connector: "and",
          conditions: [
            {
              id: "clcd0000000000000000000001",
              leftOperand: { type: "element", value: "q_nps" },
              operator: "isGreaterThan",
              rightOperand: { type: "static", value: 8 },
            },
          ],
        },
        actions: [
          {
            id: "clac0000000000000000000001",
            objective: "jumpToBlock",
            target: FIXTURE_ENDING_ID,
          },
        ],
      },
    ],
  },
  {
    id: FIXTURE_BLOCK_2_ID,
    name: "Scales",
    elements: [
      {
        id: "q_rating",
        type: "rating",
        headline: i18n("Rate us (you said: #recall:q_open/fallback:#)", "Bewerte uns"),
        required: true,
        scale: "number",
        range: 5,
        isColorCodingEnabled: false,
      },
      {
        id: "q_csat",
        type: "csat",
        headline: i18n("Satisfied?", "Zufrieden?"),
        required: true,
        scale: "smiley",
        range: 5,
        isColorCodingEnabled: false,
      },
      {
        id: "q_ces",
        type: "ces",
        headline: i18n("Effort?", "Aufwand?"),
        required: true,
        scale: "number",
        range: 7,
        isColorCodingEnabled: false,
      },
      {
        id: "q_matrix",
        type: "matrix",
        headline: i18n("Grid", "Raster"),
        required: false,
        rows: [{ id: "r1", label: i18n("Row 1", "Zeile 1") }],
        columns: [{ id: "c1", label: i18n("Col 1", "Spalte 1") }],
        shuffleOption: "none",
      },
      {
        id: "q_ranking",
        type: "ranking",
        headline: i18n("Rank", "Rangfolge"),
        required: false,
        choices: [
          { id: "rk_a", label: i18n("First", "Erstes") },
          { id: "rk_b", label: i18n("Second", "Zweites") },
        ],
      },
      {
        id: "q_pics",
        type: "pictureSelection",
        headline: i18n("Pick a picture", "Wähle ein Bild"),
        required: false,
        allowMulti: false,
        choices: [
          { id: "p_a", imageUrl: "https://example.com/a.png" },
          { id: "p_b", imageUrl: "https://example.com/b.png" },
        ],
      },
    ],
  },
  {
    id: FIXTURE_BLOCK_3_ID,
    name: "Details",
    elements: [
      {
        id: "q_date",
        type: "date",
        headline: i18n("When?", "Wann?"),
        required: false,
        format: "M-d-y",
      },
      {
        id: "q_file",
        type: "fileUpload",
        headline: i18n("Upload", "Hochladen"),
        required: false,
        allowMultipleFiles: false,
      },
      {
        id: "q_cal",
        type: "cal",
        headline: i18n("Book a call", "Termin buchen"),
        required: false,
        calUserName: "formbricks",
      },
      {
        id: "q_address",
        type: "address",
        headline: i18n("Address", "Adresse"),
        required: false,
        addressLine1: toggleInput("Street"),
        addressLine2: toggleInput("Line 2"),
        city: toggleInput("City"),
        state: toggleInput("State"),
        zip: toggleInput("ZIP"),
        country: toggleInput("Country"),
      },
      {
        id: "q_contact",
        type: "contactInfo",
        headline: i18n("Contact", "Kontakt"),
        required: false,
        firstName: toggleInput("First name"),
        lastName: toggleInput("Last name"),
        email: toggleInput("Email"),
        phone: toggleInput("Phone"),
        company: toggleInput("Company"),
      },
    ],
  },
] as unknown as TSurvey["blocks"];

export const FIXTURE_ENDINGS: TSurvey["endings"] = [
  {
    id: FIXTURE_ENDING_ID,
    type: "endScreen",
    headline: i18n("Thanks, #recall:q_open/fallback:#!", "Danke, #recall:q_open/fallback:#!"),
    subheader: i18n("We read every answer", "Wir lesen jede Antwort"),
    buttonLabel: i18n("Back to site", "Zurück"),
    buttonLink: "https://formbricks.com",
  },
];

export const FIXTURE_CODE_ACTION_CLASS: TActionClass = {
  id: "claa0000000000000000000001",
  name: "Checkout Complete",
  description: "Fired after checkout",
  type: "code",
  key: "checkout_complete",
  noCodeConfig: null,
  workspaceId: FIXTURE_WORKSPACE_ID,
  createdAt: fixtureDate,
  updatedAt: fixtureDate,
};

export const FIXTURE_NOCODE_ACTION_CLASS: TActionClass = {
  id: "claa0000000000000000000002",
  name: "Clicked pricing",
  description: null,
  type: "noCode",
  key: null,
  noCodeConfig: {
    type: "click",
    urlFilters: [],
    elementSelector: { cssSelector: "#pricing" },
  },
  workspaceId: FIXTURE_WORKSPACE_ID,
  createdAt: fixtureDate,
  updatedAt: fixtureDate,
};

/**
 * A fully featured stored link survey. Carries every field the export must NOT read (styling,
 * follow-ups, single-use, PIN, slug, custom scripts, schedule) so tests can assert they never travel.
 */
export const FIXTURE_LINK_SURVEY = {
  id: FIXTURE_SURVEY_ID,
  createdAt: fixtureDate,
  updatedAt: fixtureDate,
  name: "Product Feedback",
  type: "link",
  workspaceId: FIXTURE_WORKSPACE_ID,
  createdBy: "cluser000000000000000000001",
  status: "inProgress",
  displayOption: "displayOnce",
  autoClose: null,
  triggers: [],
  recontactDays: null,
  displayLimit: null,
  welcomeCard: {
    enabled: true,
    headline: i18n("Welcome", "Willkommen"),
    subheader: i18n("Two minutes", "Zwei Minuten"),
    buttonLabel: i18n("Start", "Los"),
    timeToFinish: true,
    showResponseCount: false,
  },
  questions: [],
  blocks: FIXTURE_BLOCKS,
  endings: FIXTURE_ENDINGS,
  hiddenFields: { enabled: true, fieldIds: ["utm_source", "plan"] },
  variables: [{ id: FIXTURE_VARIABLE_ID, name: "score", type: "number", value: 0 }],
  followUps: [
    {
      id: "clfu0000000000000000000001",
      surveyId: FIXTURE_SURVEY_ID,
      name: "Notify team",
      trigger: { type: "response", properties: null },
      action: {
        type: "send-email",
        properties: {
          to: "q_contact",
          from: "team@example.com",
          replyTo: ["team@example.com"],
          subject: "New response",
          body: "<p>Hi</p>",
          attachResponseData: true,
        },
      },
      createdAt: fixtureDate,
      updatedAt: fixtureDate,
    },
  ],
  delay: 0,
  publishOn: new Date("2026-10-01T00:00:00.000Z"),
  closeOn: new Date("2026-11-01T00:00:00.000Z"),
  archivedAt: null,
  autoComplete: null,
  workspaceOverwrites: { brandColor: "#123456" },
  styling: { brandColor: { light: "#00ff00" }, overwriteThemeStyling: true },
  showLanguageSwitch: true,
  surveyClosedMessage: { enabled: true, heading: "Closed", subheading: "Come back later" },
  segment: null,
  singleUse: { enabled: true, isEncrypted: true },
  isVerifyEmailEnabled: false,
  recaptcha: { enabled: true, threshold: 0.5 },
  isBackButtonHidden: false,
  isAutoProgressingEnabled: false,
  isCaptureIpEnabled: false,
  pin: "1234",
  displayPercentage: null,
  languages: FIXTURE_LANGUAGES,
  metadata: {
    title: i18n("Product Feedback", "Produktfeedback"),
    description: i18n("Tell us what you think", "Sag uns deine Meinung"),
  },
  slug: "product-feedback",
  customHeadScripts: "<script>alert(1)</script>",
  customHeadScriptsMode: "add",
} as unknown as TSurvey;

/** App variant with two triggers and a segment with filters (targeting must not travel). */
export const FIXTURE_APP_SURVEY = {
  ...FIXTURE_LINK_SURVEY,
  id: "clsvapp0000000000000000001",
  name: "In-App Feedback",
  type: "app",
  displayOption: "respondMultiple",
  recontactDays: 7,
  delay: 5,
  triggers: [{ actionClass: FIXTURE_CODE_ACTION_CLASS }, { actionClass: FIXTURE_NOCODE_ACTION_CLASS }],
  segment: {
    id: "clsg0000000000000000000001",
    title: "clsvapp0000000000000000001",
    description: null,
    isPrivate: true,
    filters: [
      {
        id: "clsf0000000000000000000001",
        connector: null,
        resource: {
          id: "clsr0000000000000000000001",
          root: { type: "attribute", contactAttributeKey: "plan" },
          qualifier: { operator: "equals" },
          value: "enterprise",
        },
      },
    ],
    workspaceId: FIXTURE_WORKSPACE_ID,
    surveys: ["clsvapp0000000000000000001"],
    createdAt: fixtureDate,
    updatedAt: fixtureDate,
  },
} as unknown as TSurvey;

/** Legacy question-based survey (no blocks): the export converts it. */
export const FIXTURE_LEGACY_SURVEY = {
  ...FIXTURE_LINK_SURVEY,
  id: "clsvleg0000000000000000001",
  name: "Legacy NPS",
  blocks: [],
  endings: [],
  hiddenFields: { enabled: false },
  variables: [],
  questions: [
    {
      id: "legacy_open",
      type: "openText",
      headline: i18n("Anything else?", "Noch etwas?"),
      required: false,
      inputType: "text",
      charLimit: { enabled: false },
    },
  ],
} as unknown as TSurvey;

export const FIXTURE_EMPTY_SURVEY = {
  ...FIXTURE_LINK_SURVEY,
  id: "clsvemp0000000000000000001",
  name: "Empty",
  blocks: [],
  questions: [],
  endings: [],
  hiddenFields: { enabled: false },
  variables: [],
} as unknown as TSurvey;
