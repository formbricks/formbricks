/**
 * Generates the QSF fixture pack next to this script. Run from `apps/web`:
 *
 *   npx tsx modules/survey/import/lanes/qsf/__fixtures__/scripts/generate-fixtures.ts
 *
 * The fixtures are committed; this script exists so `large-150.qsf` is reproducible and so a shape
 * change (a new question type, another Qualtrics version quirk) is one edit here rather than in nine
 * hand-written files. Golden `*.expected.json` files are written by the parser tests
 * (`toMatchFileSnapshot`), not here.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

type TChoice = { display: string; textEntry?: boolean };
type TQuestionSpec = {
  qid: string;
  tag?: string;
  text: string;
  type: string;
  selector?: string;
  subSelector?: string;
  choices?: TChoice[];
  answers?: TChoice[];
  force?: "ON" | "OFF" | "REQUEST";
  contentType?: string;
  minChars?: number;
  maxChars?: number;
  configuration?: Record<string, unknown>;
  translations?: Record<string, { text?: string; choices?: string[]; answers?: string[] }>;
  displayLogic?: unknown;
  skipLogic?: unknown;
  randomization?: Record<string, unknown>;
};

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..");
const SURVEY_ID = "SV_fixture000000000";

const choiceMap = (choices: TChoice[] | undefined) =>
  choices
    ? Object.fromEntries(
        choices.map((choice, index) => [
          String(index + 1),
          { Display: choice.display, ...(choice.textEntry ? { TextEntry: "true" } : {}) },
        ])
      )
    : undefined;

const translationMap = (values: string[] | undefined) =>
  values
    ? Object.fromEntries(values.map((value, index) => [String(index + 1), { Display: value }]))
    : undefined;

const question = (spec: TQuestionSpec) => ({
  SurveyID: SURVEY_ID,
  Element: "SQ",
  PrimaryAttribute: spec.qid,
  SecondaryAttribute: spec.text.replaceAll(/<[^>]+>/g, "").slice(0, 60),
  TertiaryAttribute: null,
  Payload: {
    QuestionText: spec.text,
    DataExportTag: spec.tag ?? spec.qid.replace("QID", "Q"),
    QuestionType: spec.type,
    Selector: spec.selector ?? null,
    ...(spec.subSelector ? { SubSelector: spec.subSelector } : {}),
    Configuration: { QuestionDescriptionOption: "UseText", ...spec.configuration },
    QuestionDescription: spec.text.replaceAll(/<[^>]+>/g, "").slice(0, 60),
    ...(spec.choices
      ? { Choices: choiceMap(spec.choices), ChoiceOrder: spec.choices.map((_, i) => String(i + 1)) }
      : {}),
    ...(spec.answers
      ? { Answers: choiceMap(spec.answers), AnswerOrder: spec.answers.map((_, i) => String(i + 1)) }
      : {}),
    Validation: {
      Settings: {
        ForceResponse: spec.force ?? "OFF",
        ForceResponseType: spec.force ?? "OFF",
        Type:
          spec.contentType || spec.minChars !== undefined || spec.maxChars !== undefined
            ? "ContentType"
            : "None",
        ...(spec.contentType ? { ContentType: spec.contentType } : {}),
        ...(spec.minChars !== undefined ? { MinChars: String(spec.minChars) } : {}),
        ...(spec.maxChars !== undefined ? { MaxChars: String(spec.maxChars) } : {}),
      },
    },
    ...(spec.translations
      ? {
          Language: Object.fromEntries(
            Object.entries(spec.translations).map(([code, translation]) => [
              code,
              {
                ...(translation.text ? { QuestionText: translation.text } : {}),
                ...(translation.choices ? { Choices: translationMap(translation.choices) } : {}),
                ...(translation.answers ? { Answers: translationMap(translation.answers) } : {}),
              },
            ])
          ),
        }
      : {}),
    ...(spec.displayLogic ? { DisplayLogic: spec.displayLogic } : {}),
    ...(spec.skipLogic ? { SkipLogic: spec.skipLogic } : {}),
    ...(spec.randomization ? { Randomization: spec.randomization } : {}),
    QuestionID: spec.qid,
    DataVisibility: { Private: false, Hidden: false },
    NextChoiceId: (spec.choices?.length ?? 0) + 1,
    NextAnswerId: (spec.answers?.length ?? 0) + 1,
  },
});

type TBlockSpec = {
  id: string;
  description: string;
  type?: "Default" | "Standard" | "Trash";
  elements: (string | "PAGE_BREAK")[];
};

const blockPayload = (block: TBlockSpec) => ({
  Type: block.type ?? "Standard",
  Description: block.description,
  ID: block.id,
  BlockElements: block.elements.map((element) =>
    element === "PAGE_BREAK" ? { Type: "Page Break" } : { Type: "Question", QuestionID: element }
  ),
});

const blocksElement = (blocks: TBlockSpec[], legacyObject = false) => ({
  SurveyID: SURVEY_ID,
  Element: "BL",
  PrimaryAttribute: "Survey Blocks",
  SecondaryAttribute: null,
  TertiaryAttribute: null,
  Payload: legacyObject
    ? Object.fromEntries(blocks.map((block, index) => [String(index), blockPayload(block)]))
    : blocks.map(blockPayload),
});

let flowCounter = 1;
const flowId = () => `FL_${flowCounter++}`;
const flowBlock = (id: string) => ({ Type: "Block", ID: id, FlowID: flowId() });
const flowEmbedded = (fields: string[]) => ({
  Type: "EmbeddedData",
  FlowID: flowId(),
  EmbeddedData: fields.map((field) => ({
    Description: field,
    Type: "Custom",
    Field: field,
    VariableType: "String",
    DataVisibility: [],
    AnalyzeText: false,
  })),
});
const flowEnd = () => ({ Type: "EndSurvey", FlowID: flowId() });
const flowBranch = (logic: unknown, children: unknown[], description = "New Branch") => ({
  Type: "Branch",
  FlowID: flowId(),
  Description: description,
  BranchLogic: logic,
  Flow: children,
});
const flowRandomizer = (children: unknown[]) => ({
  Type: "BlockRandomizer",
  FlowID: flowId(),
  SubSet: 1,
  EvenPresentation: true,
  Flow: children,
});

const flowElement = (nodes: unknown[]) => ({
  SurveyID: SURVEY_ID,
  Element: "FL",
  PrimaryAttribute: "Survey Flow",
  SecondaryAttribute: null,
  TertiaryAttribute: null,
  Payload: { Type: "Root", FlowID: "FL_root", Flow: nodes, Properties: { Count: nodes.length } },
});

const optionsElement = (overrides: Record<string, unknown> = {}) => ({
  SurveyID: SURVEY_ID,
  Element: "SO",
  PrimaryAttribute: "Survey Options",
  SecondaryAttribute: null,
  TertiaryAttribute: null,
  Payload: {
    BackButton: "false",
    SaveAndContinue: "true",
    SurveyProtection: "PublicSurvey",
    ProgressBarDisplay: "None",
    PartialData: "+1 week",
    EOSMessage: "",
    EOSRedirectURL: "",
    NextButton: "→",
    PreviousButton: "←",
    ShowExportTags: "false",
    ...overrides,
  },
});

const boilerplate = (questionCount: number) => [
  {
    SurveyID: SURVEY_ID,
    Element: "QC",
    PrimaryAttribute: "Survey Question Count",
    SecondaryAttribute: String(questionCount),
    TertiaryAttribute: null,
    Payload: null,
  },
  {
    SurveyID: SURVEY_ID,
    Element: "STAT",
    PrimaryAttribute: "Survey Statistics",
    SecondaryAttribute: null,
    TertiaryAttribute: null,
    Payload: { MobileCompatible: true, ID: "Survey Statistics" },
  },
  {
    SurveyID: SURVEY_ID,
    Element: "RS",
    PrimaryAttribute: "RS_fixture",
    SecondaryAttribute: "Default Response Set",
    TertiaryAttribute: null,
    Payload: null,
  },
  {
    SurveyID: SURVEY_ID,
    Element: "SCO",
    PrimaryAttribute: "Scoring",
    SecondaryAttribute: null,
    TertiaryAttribute: null,
    Payload: {
      ScoringCategories: [],
      ScoringCategoryGroups: [],
      ScoringSummaryCategory: null,
      ScoringSummaryAfterQuestions: 0,
      ScoringSummaryAfterSurvey: 0,
      DefaultScoringCategory: null,
      AutoScoringCategory: null,
    },
  },
  {
    SurveyID: SURVEY_ID,
    Element: "PROJ",
    PrimaryAttribute: "CORE",
    SecondaryAttribute: null,
    TertiaryAttribute: "1.1.0",
    Payload: { ProjectCategory: "CORE", SchemaVersion: "1.1.0" },
  },
];

const survey = (name: string, language: string, elements: unknown[], questionCount: number) => ({
  SurveyEntry: {
    SurveyID: SURVEY_ID,
    SurveyName: name,
    SurveyDescription: null,
    SurveyOwnerID: "UR_fixture",
    SurveyBrandID: "fixture",
    DivisionID: null,
    SurveyLanguage: language,
    SurveyActiveResponseSet: "RS_fixture",
    SurveyStatus: "Active",
    SurveyStartDate: "0000-00-00 00:00:00",
    SurveyExpirationDate: "0000-00-00 00:00:00",
    SurveyCreationDate: "2026-09-01 10:00:00",
    CreatorID: "UR_fixture",
    LastModified: "2026-09-08 10:00:00",
    LastAccessed: "0000-00-00 00:00:00",
    LastActivated: "2026-09-01 10:00:00",
    Deleted: null,
  },
  SurveyElements: [...elements, ...boilerplate(questionCount)],
});

const write = (name: string, content: unknown) => {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(
    join(OUT_DIR, name),
    typeof content === "string" ? content : `${JSON.stringify(content, null, 2)}\n`
  );
  console.log(`wrote ${name}`);
};

const expression = (qid: string, choice: number, operator = "Selected", description = "") => ({
  LogicType: "Question",
  QuestionID: qid,
  QuestionIsInLoop: "no",
  ChoiceLocator: `q://${qid}/SelectableChoice/${choice}`,
  Operator: operator,
  QuestionIDFromLocator: qid,
  LeftOperand: `q://${qid}/SelectableChoice/${choice}`,
  Type: "Expression",
  Description: description,
});

const booleanExpression = (expressions: Record<string, unknown>[], inPage = false) => ({
  "0": {
    ...Object.fromEntries(
      expressions.map((exp, index) => [String(index), index === 0 ? exp : { ...exp, Conjuction: "And" }])
    ),
    Type: "If",
  },
  Type: "BooleanExpression",
  inPage,
});

// ---------- simple.qsf ----------
flowCounter = 1;
write(
  "simple.qsf",
  survey(
    "Customer feedback",
    "EN",
    [
      question({
        qid: "QID1",
        text: "How did you hear about us?",
        type: "MC",
        selector: "SAVR",
        subSelector: "TX",
        force: "ON",
        choices: [
          { display: "Search engine" },
          { display: "A friend" },
          { display: "Other", textEntry: true },
        ],
      }),
      question({
        qid: "QID2",
        text: "How likely are you to recommend us to a friend?",
        type: "MC",
        selector: "NPS",
        force: "ON",
        choices: Array.from({ length: 11 }, (_, i) => ({ display: String(i) })),
      }),
      question({ qid: "QID3", text: "What should we <strong>improve</strong>?", type: "TE", selector: "ML" }),
      question({
        qid: "QID4",
        text: "Your email",
        type: "TE",
        selector: "SL",
        contentType: "ValidEmail",
        force: "REQUEST",
      }),
      question({
        qid: "QID5",
        text: "Which features do you use?",
        type: "MC",
        selector: "MAVR",
        subSelector: "TX",
        choices: [{ display: "Surveys" }, { display: "Contacts" }, { display: "Integrations" }],
        randomization: { Type: "All", Advanced: null, TotalRandSubset: "" },
      }),
      blocksElement([
        {
          id: "BL_default",
          description: "Default Question Block",
          type: "Default",
          elements: ["QID1", "QID2", "QID3", "QID4", "QID5"],
        },
      ]),
      flowElement([flowBlock("BL_default"), flowEnd()]),
      optionsElement({ EOSMessage: "Thank you for your feedback!" }),
    ],
    5
  )
);

// ---------- multilang-en-de.qsf ----------
flowCounter = 1;
write(
  "multilang-en-de.qsf",
  survey(
    "Produktfeedback",
    "EN",
    [
      question({
        qid: "QID1",
        text: "How satisfied are you?",
        type: "MC",
        selector: "SAVR",
        subSelector: "TX",
        force: "ON",
        choices: [{ display: "Very satisfied" }, { display: "Satisfied" }, { display: "Unsatisfied" }],
        translations: {
          DE: { text: "Wie zufrieden sind Sie?", choices: ["Sehr zufrieden", "Zufrieden", "Unzufrieden"] },
        },
      }),
      question({
        qid: "QID2",
        text: "Anything else?",
        type: "TE",
        selector: "ML",
        translations: { DE: { text: "Noch etwas?" } },
      }),
      question({
        qid: "QID3",
        text: "Rate these statements",
        type: "Matrix",
        selector: "Likert",
        subSelector: "SingleAnswer",
        choices: [{ display: "Easy to use" }, { display: "Good value" }],
        answers: [{ display: "Agree" }, { display: "Neutral" }, { display: "Disagree" }],
        translations: {
          DE: {
            text: "Bewerten Sie diese Aussagen",
            choices: ["Einfach zu bedienen", "Gutes Preis-Leistungs-Verhältnis"],
            answers: ["Stimme zu", "Neutral", "Stimme nicht zu"],
          },
        },
      }),
      blocksElement([
        { id: "BL_1", description: "Feedback", type: "Default", elements: ["QID1", "QID2", "QID3"] },
      ]),
      flowElement([flowBlock("BL_1"), flowEnd()]),
      optionsElement({ EOSMessage: "Danke! / Thank you!" }),
    ],
    3
  )
);

// ---------- logic-skip-display-branch.qsf ----------
flowCounter = 1;
write(
  "logic-skip-display-branch.qsf",
  survey(
    "Logic showcase",
    "EN",
    [
      question({
        qid: "QID1",
        text: "Do you use our product?",
        type: "MC",
        selector: "SAVR",
        subSelector: "TX",
        force: "ON",
        choices: [{ display: "Yes" }, { display: "No" }],
        skipLogic: [
          {
            SkipLogicID: "SL_1",
            ChoiceLocator: "q://QID1/SelectableChoice/2",
            Condition: "Selected",
            SkipToDestination: "ENDOFSURVEY",
            SkipToDescription: "End of Survey",
            Locator: "q://QID1/SelectableChoice/2",
            Type: "SkipLogic",
          },
        ],
      }),
      question({
        qid: "QID2",
        text: "How often?",
        type: "MC",
        selector: "SAVR",
        subSelector: "TX",
        choices: [{ display: "Daily" }, { display: "Weekly" }, { display: "Rarely" }],
        displayLogic: booleanExpression([
          expression("QID1", 1, "Selected", "If Do you use our product? Yes Is Selected"),
        ]),
      }),
      question({
        qid: "QID3",
        text: "Which region are you in?",
        type: "MC",
        selector: "DL",
        choices: [{ display: "EU" }, { display: "US" }, { display: "Other" }],
        skipLogic: [
          {
            SkipLogicID: "SL_2",
            ChoiceLocator: "q://QID3/SelectableChoice/3",
            Condition: "Selected",
            SkipToDestination: "QID5",
            SkipToDescription: "Any final comments?",
            Locator: "q://QID3/SelectableChoice/3",
            Type: "SkipLogic",
          },
        ],
      }),
      question({
        qid: "QID4",
        text: "EU: are you GDPR compliant?",
        type: "MC",
        selector: "SAVR",
        subSelector: "TX",
        choices: [{ display: "Yes" }, { display: "No" }],
        displayLogic: {
          "0": {
            "0": {
              LogicType: "EmbeddedField",
              LeftOperand: "region",
              Operator: "EqualTo",
              RightOperand: "DE",
              Type: "Expression",
              Description: "If region Is Equal to DE",
            },
            Type: "If",
          },
          Type: "BooleanExpression",
          inPage: false,
        },
      }),
      question({ qid: "QID5", text: "Any final comments?", type: "TE", selector: "ML" }),
      question({
        qid: "QID6",
        text: "Unreadable logic",
        type: "TE",
        selector: "SL",
        displayLogic: {
          Type: "BooleanExpression",
          "0": { Type: "If", "0": { Type: "Expression", LogicType: "Quota" } },
        },
      }),
      blocksElement([
        {
          id: "BL_1",
          description: "Usage",
          type: "Default",
          elements: ["QID1", "QID2", "PAGE_BREAK", "QID3"],
        },
        { id: "BL_2", description: "Compliance", elements: ["QID4"] },
        { id: "BL_3", description: "Wrap up", elements: ["QID5", "QID6"] },
      ]),
      flowElement([
        flowEmbedded(["region"]),
        flowBlock("BL_1"),
        flowBranch(
          booleanExpression([
            expression("QID3", 1, "Selected", "If Which region are you in? EU Is Selected"),
          ]),
          [flowBlock("BL_2")],
          "EU branch"
        ),
        flowBlock("BL_3"),
        flowEnd(),
      ]),
      optionsElement(),
    ],
    6
  )
);

// ---------- matrix-slider-ranking.qsf ----------
flowCounter = 1;
write(
  "matrix-slider-ranking.qsf",
  survey(
    "Advanced types",
    "EN",
    [
      question({
        qid: "QID1",
        text: "Rate our service",
        type: "Matrix",
        selector: "Likert",
        subSelector: "SingleAnswer",
        force: "ON",
        choices: [{ display: "Speed" }, { display: "Friendliness" }],
        answers: [{ display: "Poor" }, { display: "OK" }, { display: "Great" }],
      }),
      question({
        qid: "QID2",
        text: "Pick all that apply per row",
        type: "Matrix",
        selector: "Likert",
        subSelector: "MultipleAnswer",
        choices: [{ display: "Row" }],
        answers: [{ display: "A" }, { display: "B" }],
      }),
      question({
        qid: "QID3",
        text: "How much do you agree?",
        type: "Slider",
        selector: "HSLIDER",
        configuration: { CSSliderMin: 0, CSSliderMax: 10, GridLines: 10, NumDecimals: "0" },
        choices: [{ display: "The product is fast" }, { display: "The product is stable" }],
      }),
      question({
        qid: "QID4",
        text: "Star rating",
        type: "Slider",
        selector: "STAR",
        configuration: { CSSliderMin: 0, CSSliderMax: 5, NumStars: 5 },
        choices: [{ display: "Overall" }],
      }),
      question({
        qid: "QID5",
        text: "Rank these priorities",
        type: "RO",
        selector: "DND",
        choices: [{ display: "Speed" }, { display: "Price" }, { display: "Support" }, { display: "Design" }],
      }),
      question({
        qid: "QID6",
        text: "<p>Welcome to the <em>advanced</em> section.</p><ul><li>Item</li></ul>",
        type: "DB",
        selector: "TB",
      }),
      question({ qid: "QID7", text: "Upload a screenshot", type: "FileUpload", selector: "FileUpload" }),
      question({
        qid: "QID8",
        text: "Contact details",
        type: "TE",
        selector: "FORM",
        choices: [{ display: "First name" }, { display: "Last name" }, { display: "Company" }],
      }),
      question({ qid: "QID9", text: "Timing", type: "Timing", selector: "PageTimer" }),
      question({
        qid: "QID10",
        text: "Allocate 100 points",
        type: "CS",
        selector: "HSLIDER",
        choices: [{ display: "A" }, { display: "B" }],
      }),
      question({ qid: "QID11", text: "Side by side", type: "SBS", selector: "SBSMatrix" }),
      question({
        qid: "QID12",
        text: "Twenty-six options",
        type: "RO",
        selector: "DND",
        choices: Array.from({ length: 26 }, (_, i) => ({ display: `Option ${i + 1}` })),
      }),
      blocksElement([
        {
          id: "BL_1",
          description: "Advanced",
          type: "Default",
          elements: [
            "QID6",
            "QID1",
            "QID2",
            "PAGE_BREAK",
            "QID3",
            "QID4",
            "QID5",
            "PAGE_BREAK",
            "QID7",
            "QID8",
            "QID9",
            "QID10",
            "QID11",
            "QID12",
          ],
        },
      ]),
      flowElement([flowBlock("BL_1"), flowEnd()]),
      optionsElement({ EOSRedirectURL: "https://example.com/thanks" }),
    ],
    12
  )
);

// ---------- pages-and-blocks.qsf ----------
flowCounter = 1;
write(
  "pages-and-blocks.qsf",
  survey(
    "Pages and blocks",
    "EN",
    [
      question({ qid: "QID1", text: "Page one question", type: "TE", selector: "SL" }),
      question({ qid: "QID2", text: "Page two question", type: "TE", selector: "SL" }),
      question({ qid: "QID3", text: "Second block question", type: "TE", selector: "SL" }),
      question({ qid: "QID4", text: "Trashed question", type: "TE", selector: "SL" }),
      question({ qid: "QID5", text: "Orphan block question", type: "TE", selector: "SL" }),
      blocksElement([
        { id: "BL_a", description: "Block A", type: "Default", elements: ["QID1", "PAGE_BREAK", "QID2"] },
        { id: "BL_b", description: "Block B", elements: ["QID3"] },
        { id: "BL_orphan", description: "Not in flow", elements: ["QID5"] },
        { id: "BL_trash", description: "Trash / Unused Questions", type: "Trash", elements: ["QID4"] },
      ]),
      // Flow order differs from BL order: B comes first.
      flowElement([flowBlock("BL_b"), flowRandomizer([flowBlock("BL_a")]), flowEnd()]),
      optionsElement({
        NextButton: "Continue",
        PreviousButton: "Back",
        BackButton: "true",
        ProgressBarDisplay: "Text",
      }),
    ],
    5
  )
);

// ---------- embedded-data.qsf ----------
flowCounter = 1;
write(
  "embedded-data.qsf",
  survey(
    "Embedded data",
    "EN",
    [
      question({
        qid: "QID1",
        text: "Hello ${e://Field/firstName}, how was your visit to ${e://Field/Store-Name}?",
        type: "TE",
        selector: "ML",
      }),
      question({
        qid: "QID2",
        text: "You said: ${q://QID1/ChoiceTextEntryValue}. Anything to add? ${loc://something}",
        type: "TE",
        selector: "SL",
      }),
      blocksElement([
        { id: "BL_1", description: "Default Question Block", type: "Default", elements: ["QID1", "QID2"] },
      ]),
      flowElement([
        flowEmbedded(["firstName", "Store-Name", "userId", "plan tier"]),
        flowBlock("BL_1"),
        flowEnd(),
      ]),
      optionsElement(),
    ],
    2
  )
);

// ---------- large-150.qsf ----------
flowCounter = 1;
{
  const types = [
    "MC-SAVR",
    "MC-MAVR",
    "TE-SL",
    "TE-ML",
    "MC-NPS",
    "Matrix",
    "Slider",
    "RO",
    "MC-DL",
    "DB",
  ] as const;
  const questions: unknown[] = [];
  const blockElements: string[] = [];
  for (let i = 1; i <= 150; i++) {
    const kind = types[(i - 1) % types.length];
    const qid = `QID${i}`;
    const text = `Question ${i}: ${kind}`;
    switch (kind) {
      case "MC-SAVR":
      case "MC-MAVR":
      case "MC-DL":
        questions.push(
          question({
            qid,
            text,
            type: "MC",
            selector: kind.split("-")[1],
            subSelector: "TX",
            force: i % 3 === 0 ? "ON" : "OFF",
            choices: [{ display: "A" }, { display: "B" }, { display: "C" }],
          })
        );
        break;
      case "MC-NPS":
        questions.push(
          question({
            qid,
            text,
            type: "MC",
            selector: "NPS",
            choices: Array.from({ length: 11 }, (_, n) => ({ display: String(n) })),
          })
        );
        break;
      case "TE-SL":
      case "TE-ML":
        questions.push(question({ qid, text, type: "TE", selector: kind.split("-")[1] }));
        break;
      case "Matrix":
        questions.push(
          question({
            qid,
            text,
            type: "Matrix",
            selector: "Likert",
            subSelector: "SingleAnswer",
            choices: [{ display: "R1" }, { display: "R2" }],
            answers: [{ display: "1" }, { display: "2" }, { display: "3" }],
          })
        );
        break;
      case "Slider":
        questions.push(
          question({
            qid,
            text,
            type: "Slider",
            selector: "HSLIDER",
            configuration: { CSSliderMin: 0, CSSliderMax: 7 },
            choices: [{ display: "Statement" }],
          })
        );
        break;
      case "RO":
        questions.push(
          question({
            qid,
            text,
            type: "RO",
            selector: "DND",
            choices: [{ display: "X" }, { display: "Y" }, { display: "Z" }],
          })
        );
        break;
      case "DB":
        questions.push(question({ qid, text: `<p>${text}</p>`, type: "DB", selector: "TB" }));
        break;
    }
    blockElements.push(qid);
    if (i % 5 === 0 && i < 150) blockElements.push("PAGE_BREAK");
  }
  const blocks: TBlockSpec[] = [];
  for (let b = 0; b < 10; b++) {
    blocks.push({
      id: `BL_${b + 1}`,
      description: `Block ${b + 1}`,
      type: b === 0 ? "Default" : "Standard",
      elements: blockElements.slice(b * 18, (b + 1) * 18),
    });
  }
  write(
    "large-150.qsf",
    survey(
      "Large survey",
      "EN",
      [
        ...questions,
        blocksElement(blocks),
        flowElement([...blocks.map((block) => flowBlock(block.id)), flowEnd()]),
        optionsElement(),
      ],
      150
    )
  );
}

// ---------- legacy-object-payload.qsf ----------
flowCounter = 1;
write(
  "legacy-object-payload.qsf",
  survey(
    "Legacy export",
    "DE",
    [
      question({
        qid: "QID1",
        text: "Wie geht es Ihnen?",
        type: "MC",
        selector: "SAVR",
        subSelector: "TX",
        choices: [{ display: "Gut" }, { display: "Schlecht" }],
      }),
      question({ qid: "QID2", text: "Kommentar", type: "TE", selector: "ML" }),
      blocksElement(
        [{ id: "BL_1", description: "Standardfrageblock", type: "Default", elements: ["QID1", "QID2"] }],
        true
      ),
      flowElement([flowBlock("BL_1"), { Type: "WebService", FlowID: "FL_ws" }, flowEnd()]),
      optionsElement(),
      {
        SurveyID: SURVEY_ID,
        Element: "XYZ",
        PrimaryAttribute: "Future element",
        SecondaryAttribute: null,
        TertiaryAttribute: null,
        Payload: { anything: true },
      },
    ],
    2
  )
);

// ---------- invalid.qsf ----------
write("invalid.qsf", '{ "SurveyEntry": { "SurveyName": "Broken" }, "SurveyElements": [ { "Element": "SQ" ');
write("not-a-qsf.json", { name: "Just a v3 document", blocks: [] });
