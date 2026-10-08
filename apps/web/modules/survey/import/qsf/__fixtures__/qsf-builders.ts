/**
 * Builders of Qualtrics exports for the QSF fixtures (ENG-3654), shared by the fixture generator
 * (`scripts/generate-qsf-fixtures.ts`), which writes the small fixtures to disk, and by the tests,
 * which build the two largest — `large-150.qsf` and `over-limit.qsf` — in memory instead of
 * committing them (`loadQsfFixture` does it for them).
 */
type TChoice = { display: string; textEntry?: boolean; exclusive?: boolean };
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
  validDateType?: string;
  configuration?: Record<string, unknown>;
  translations?: Record<string, { text?: string; choices?: string[]; answers?: string[] }>;
  displayLogic?: unknown;
  skipLogic?: unknown;
  randomization?: Record<string, unknown>;
};

export const SURVEY_ID = "SV_fixture000000000";

/**
 * An object with the given keys as own, enumerable data properties. An object literal cannot hold an
 * own `__proto__` key — `{ __proto__: x }` sets the prototype — and the hostile fixtures need exactly
 * that, the way `JSON.parse` produces it.
 */
export const own = (entries: [string, unknown][]): Record<string, unknown> => {
  const record: Record<string, unknown> = {};
  for (const [key, value] of entries) {
    Object.defineProperty(record, key, { value, enumerable: true, writable: true, configurable: true });
  }
  return record;
};

const choiceMap = (choices: TChoice[] | undefined) =>
  choices
    ? Object.fromEntries(
        choices.map((choice, index) => [
          String(index + 1),
          {
            Display: choice.display,
            ...(choice.textEntry ? { TextEntry: "true" } : {}),
            ...(choice.exclusive ? { ExclusiveAnswer: true } : {}),
          },
        ])
      )
    : undefined;

const translationMap = (values: string[] | undefined) =>
  values
    ? Object.fromEntries(values.map((value, index) => [String(index + 1), { Display: value }]))
    : undefined;

const plainText = (html: string) => html.replaceAll(/<[^<>]+>/g, "").slice(0, 60);

export const question = (spec: TQuestionSpec) => ({
  SurveyID: SURVEY_ID,
  Element: "SQ",
  PrimaryAttribute: spec.qid,
  SecondaryAttribute: plainText(spec.text),
  TertiaryAttribute: null,
  Payload: {
    QuestionText: spec.text,
    DataExportTag: spec.tag ?? spec.qid.replace("QID", "Q"),
    QuestionType: spec.type,
    Selector: spec.selector ?? null,
    ...(spec.subSelector ? { SubSelector: spec.subSelector } : {}),
    Configuration: { QuestionDescriptionOption: "UseText", ...spec.configuration },
    QuestionDescription: plainText(spec.text),
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
        Type: spec.contentType ? "ContentType" : "None",
        ...(spec.contentType ? { ContentType: spec.contentType } : {}),
        ...(spec.validDateType ? { ValidDateType: spec.validDateType } : {}),
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

export const blocksElement = (blocks: TBlockSpec[], legacyObject = false) => ({
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
/** Number flow ids from 1 again: each fixture starts its own. */
export const resetFlowIds = (): void => {
  flowCounter = 1;
};
const flowId = () => `FL_${flowCounter++}`;
export const flowBlock = (id: string) => ({ Type: "Block", ID: id, FlowID: flowId() });
export const flowEmbedded = (fields: string[]) => ({
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
export const flowEnd = () => ({ Type: "EndSurvey", FlowID: flowId() });
export const flowBranch = (logic: unknown, children: unknown[], description = "New Branch") => ({
  Type: "Branch",
  FlowID: flowId(),
  Description: description,
  BranchLogic: logic,
  Flow: children,
});
export const flowRandomizer = (children: unknown[]) => ({
  Type: "BlockRandomizer",
  FlowID: flowId(),
  SubSet: 1,
  EvenPresentation: true,
  Flow: children,
});
export const flowGroup = (children: unknown[]) => ({
  Type: "Group",
  FlowID: flowId(),
  Description: "Group",
  Flow: children,
});

export const flowElement = (nodes: unknown[]) => ({
  SurveyID: SURVEY_ID,
  Element: "FL",
  PrimaryAttribute: "Survey Flow",
  SecondaryAttribute: null,
  TertiaryAttribute: null,
  Payload: { Type: "Root", FlowID: "FL_root", Flow: nodes, Properties: { Count: nodes.length } },
});

export const optionsElement = (overrides: Record<string, unknown> = {}) => ({
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

/**
 * The survey-wide elements every export carries. Owner ids, the response set and scoring live here;
 * the import must never send any of them to the AI.
 */
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

export const survey = (name: string, language: string, elements: unknown[], questionCount: number) => ({
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

export const expression = (qid: string, choice: number, operator = "Selected", description = "") => ({
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

export const booleanExpression = (expressions: Record<string, unknown>[], inPage = false) => ({
  "0": {
    ...Object.fromEntries(
      expressions.map((exp, index) => [String(index), index === 0 ? exp : { ...exp, Conjuction: "And" }])
    ),
    Type: "If",
  },
  Type: "BooleanExpression",
  inPage,
});

/**
 * `large-150.qsf`: 150 questions of ten kinds on 30 pages in 10 blocks, the size the import is built
 * for. Built where it is used rather than committed (about 190 KB as a file).
 */
export function buildLarge150Qsf(): Record<string, unknown> {
  resetFlowIds();
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
  return survey(
    "Large survey",
    "EN",
    [
      ...questions,
      blocksElement(blocks),
      flowElement([...blocks.map((block) => flowBlock(block.id)), flowEnd()]),
      optionsElement(),
    ],
    150
  );
}

/** `over-limit.qsf`: one question past the reader's limit of 200. Built where it is used (about 190 KB as a file). */
export function buildOverLimitQsf(): Record<string, unknown> {
  resetFlowIds();
  const count = 201;
  const qids = Array.from({ length: count }, (_, i) => `QID${i + 1}`);
  return survey(
    "Over the limit",
    "EN",
    [
      ...qids.map((qid, i) => question({ qid, text: `Question ${i + 1}`, type: "TE", selector: "SL" })),
      blocksElement([{ id: "BL_1", description: "All", type: "Default", elements: qids }]),
      flowElement([flowBlock("BL_1"), flowEnd()]),
      optionsElement(),
    ],
    count
  );
}
