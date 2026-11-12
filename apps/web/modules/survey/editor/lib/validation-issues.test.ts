import { TFunction } from "i18next";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { TSurvey } from "@formbricks/types/surveys/types";
import { checkForEmptyFallBackValue } from "@/lib/utils/recall";
import {
  TEditorIssue,
  areIssueListsEqual,
  collectEditorIssues,
  countIssuesByTab,
  getFieldIssue,
  getIssueTargetIds,
  getPublishTargetStatus,
  getSchemaIssues,
  getSurveyRuleIssues,
  isInlineIssueField,
  reconcileIssues,
  sortIssuesForSummary,
  toIssueFieldKey,
} from "./validation-issues";

vi.mock("@/lib/utils/recall", async (importOriginal) => ({
  ...(await importOriginal()),
  checkForEmptyFallBackValue: vi.fn(),
}));

// Echoes the key, with its options when there are any, so a test sees both what was said and about what.
const t = ((key: string, options?: Record<string, unknown>) =>
  options ? `${key}:${JSON.stringify(options)}` : key) as TFunction;

const buildLanguage = (id: string, code: string, isDefault: boolean) => ({
  language: {
    id,
    code,
    alias: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    workspaceId: "cl9dsxhzt0000qz0h5z6z6z62",
  },
  default: isDefault,
  enabled: true,
});

const buildSurvey = (blocks: Record<string, unknown>[], overrides: Record<string, unknown> = {}) =>
  ({
    id: "cl9dsxhzt0000qz0h5z6z6z61",
    createdAt: new Date(),
    updatedAt: new Date(),
    name: "Survey",
    type: "link",
    workspaceId: "cl9dsxhzt0000qz0h5z6z6z62",
    createdBy: null,
    visibility: "workspace",
    ownerId: null,
    visibilityVersion: 0,
    visibilityProjectedVersion: 0,
    visibilityChangedAt: null,
    visibilityChangedById: null,
    status: "draft",
    publishOn: null,
    closeOn: null,
    displayOption: "displayOnce",
    autoClose: null,
    triggers: [],
    recontactDays: null,
    displayLimit: null,
    welcomeCard: { enabled: false, timeToFinish: false, showResponseCount: false },
    questions: [],
    blocks,
    endings: [],
    hiddenFields: { enabled: false },
    delay: 0,
    displayPercentage: null,
    autoComplete: null,
    surveyClosedMessage: null,
    workspaceOverwrites: null,
    recaptcha: null,
    singleUse: null,
    styling: null,
    segment: null,
    languages: [
      buildLanguage("cl9dsxhzt0000qz0h5z6z6z6a", "en", true),
      buildLanguage("cl9dsxhzt0000qz0h5z6z6z6b", "de", false),
    ],
    showLanguageSwitch: false,
    isVerifyEmailEnabled: false,
    variables: [],
    followUps: [],
    isBackButtonHidden: false,
    isAutoProgressingEnabled: true,
    metadata: {},
    slug: null,
    isCaptureIpEnabled: false,
    isAnonymizeResponsesEnabled: false,
    ...overrides,
  }) as unknown as TSurvey;

const openText = (headline: Record<string, string | undefined>, extra: Record<string, unknown> = {}) => ({
  id: "q1",
  type: "openText",
  headline,
  required: false,
  inputType: "text",
  charLimit: { enabled: false },
  ...extra,
});

const block = (elements: Record<string, unknown>[], name = "Block 1") => ({ id: "block1", name, elements });

const issue = (overrides: Partial<TEditorIssue>): TEditorIssue => ({
  key: `${overrides.targetId ?? overrides.tab}|${overrides.field}`,
  tab: "elements",
  targetId: null,
  level: "field",
  field: null,
  message: "message",
  location: null,
  ...overrides,
});

describe("getSchemaIssues", () => {
  test("finds nothing in a complete survey", () => {
    const survey = buildSurvey([block([openText({ default: "Name?", de: "Name?" })])]);
    expect(getSchemaIssues(survey, t, "en-US")).toEqual([]);
  });

  test("puts an empty question on its headline, with where it is and what to do", () => {
    const survey = buildSurvey([block([openText({ default: "", de: "Name?" })])]);

    expect(getSchemaIssues(survey, t, "en-US")).toEqual([
      expect.objectContaining({
        tab: "elements",
        targetId: "q1",
        level: "field",
        field: "headline",
        message: "workspace.surveys.edit.issue_enter_question",
        location: 'workspace.surveys.edit.issue_location_question:{"blockNumber":1,"questionNumber":1}',
      }),
    ]);
  });

  test("reports a missing translation once per language, on the Language tab, not on the question", () => {
    const survey = buildSurvey([
      block([openText({ default: "Name?", de: "" }, { subheader: { default: "Hint", de: "" } })]),
    ]);

    const issues = getSchemaIssues(survey, t, "en-US");

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ tab: "language", targetId: null, languageCode: "de" });
    expect(issues[0].message).toContain("workspace.surveys.edit.issue_language_missing_translations");
    expect(issues[0].message).toContain('"count":2');
  });

  test("counts a translation that is absent, not just empty, the same way: a language added to the survey has no entry yet", () => {
    const survey = buildSurvey([block([openText({ default: "Name?" }, { subheader: { default: "Hint" } })])]);

    const issues = getSchemaIssues(survey, t, "en-US");

    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ tab: "language", targetId: null, languageCode: "de" });
    expect(issues[0].message).toContain('"count":2');
  });

  test("names a field the schema rejects with its own wording by the label the author sees", () => {
    const survey = buildSurvey([
      block([
        {
          id: "q1",
          type: "multipleChoiceSingle",
          headline: { default: "Pick one", de: "Wähle eins" },
          required: true,
          shuffleOption: "random",
          choices: [
            { id: "c1", label: { default: "A", de: "A" } },
            { id: "c2", label: { default: "B", de: "B" } },
          ],
        },
      ]),
    ]);

    expect(getSchemaIssues(survey, t, "en-US")).toEqual([
      expect.objectContaining({
        targetId: "q1",
        field: "shuffleOption",
        message:
          'workspace.surveys.edit.issue_check_field:{"field":"workspace.surveys.edit.field_label_shuffle_option"}',
      }),
    ]);
  });

  test("counts a translation missing from one matrix row against its language", () => {
    const survey = buildSurvey([
      block([
        {
          id: "matrix1",
          type: "matrix",
          headline: { default: "How satisfied?", de: "Wie zufrieden?" },
          required: true,
          rows: [
            { id: "r1", label: { default: "Design", de: "Design" } },
            { id: "r2", label: { default: "Performance", de: undefined } },
          ],
          columns: [
            { id: "c1", label: { default: "Good", de: "Gut" } },
            { id: "c2", label: { default: "Bad", de: "Schlecht" } },
          ],
        },
      ]),
    ]);

    expect(getSchemaIssues(survey, t, "en-US")).toEqual([
      expect.objectContaining({
        tab: "language",
        targetId: null,
        languageCode: "de",
        message: expect.stringContaining('"count":1'),
      }),
    ]);
  });

  test("puts an empty choice on its own input, whatever the schema calls it", () => {
    const survey = buildSurvey([
      block([
        {
          id: "q1",
          type: "multipleChoiceSingle",
          headline: { default: "Pick one", de: "Wähle eins" },
          required: true,
          choices: [
            { id: "c1", label: { default: "", de: "A" } },
            { id: "c2", label: { default: "B", de: "B" } },
          ],
        },
      ]),
    ]);

    expect(getSchemaIssues(survey, t, "en-US")).toEqual([
      expect.objectContaining({
        targetId: "q1",
        level: "field",
        field: "choices.0.label",
        message: "workspace.surveys.edit.issue_enter_option",
      }),
    ]);
  });

  test("puts an empty matrix row and column on their inputs", () => {
    const survey = buildSurvey([
      block([
        {
          id: "matrix1",
          type: "matrix",
          headline: { default: "How satisfied?", de: "Wie zufrieden?" },
          required: true,
          rows: [{ id: "r1", label: { default: "", de: "Design" } }],
          columns: [{ id: "c1", label: { default: "", de: "Gut" } }],
        },
      ]),
    ]);

    expect(getSchemaIssues(survey, t, "en-US").map(({ field, message }) => ({ field, message }))).toEqual([
      { field: "rows.0.label", message: "workspace.surveys.edit.issue_enter_row" },
      { field: "columns.0.label", message: "workspace.surveys.edit.issue_enter_column" },
    ]);
  });

  test("puts an empty welcome card headline on the card's own headline input", () => {
    const survey = buildSurvey([block([openText({ default: "Name?", de: "Name?" })])], {
      welcomeCard: {
        enabled: true,
        headline: { default: "", de: "Hallo" },
        timeToFinish: false,
        showResponseCount: false,
      },
    });

    expect(getSchemaIssues(survey, t, "en-US")).toEqual([
      expect.objectContaining({
        targetId: "start",
        field: "headline",
        level: "field",
        message: "workspace.surveys.edit.issue_enter_headline",
        location: "common.welcome_card",
      }),
    ]);
  });

  test("puts an empty ending card headline on that ending", () => {
    const survey = buildSurvey([block([openText({ default: "Name?", de: "Name?" })])], {
      endings: [{ id: "end1", type: "endScreen", headline: { default: "", de: "Danke" } }],
    });

    expect(getSchemaIssues(survey, t, "en-US")).toEqual([
      expect.objectContaining({
        targetId: "end1",
        field: "headline",
        message: "workspace.surveys.edit.issue_enter_headline",
      }),
    ]);
  });

  test("lists a show-if that is not finished on the Flow tab, not on its question", () => {
    const condition = {
      id: "cl9dsxhzt0000qz0h5z6z6c01",
      connector: "and",
      conditions: [
        {
          id: "cl9dsxhzt0000qz0h5z6z6c02",
          leftOperand: { type: "element", value: "q1" },
          operator: "equals",
        },
      ],
    };
    const survey = buildSurvey([
      { id: "block1", name: "Block 1", elements: [openText({ default: "Name?", de: "Name?" })] },
      {
        id: "block2",
        name: "Block 2",
        elements: [{ ...openText({ default: "Age?", de: "Alter?" }), id: "q2", showIf: condition }],
      },
    ]);

    expect(getSchemaIssues(survey, t, "en-US")).toEqual([
      expect.objectContaining({
        tab: "flow",
        targetId: "q2",
        field: "showIf",
        location: 'workspace.surveys.edit.issue_location_question:{"blockNumber":2,"questionNumber":1}',
        // Said in the author's words, not the schema's ("Right operand is required for operator ...").
        message: expect.stringContaining("workspace.surveys.edit.issue_show_if_value"),
      }),
    ]);
  });

  test("counts a broken show-if once, and tells a question's from one of its options'", () => {
    const unfinished = (id: string) => ({
      id,
      connector: "and",
      conditions: [
        {
          id: `${id}x`,
          leftOperand: { type: "element", value: "q1" },
          operator: "equals",
        },
      ],
    });
    const survey = buildSurvey([
      { id: "block1", name: "Block 1", elements: [openText({ default: "Name?", de: "Name?" })] },
      {
        id: "block2",
        name: "Block 2",
        elements: [
          {
            id: "q2",
            type: "multipleChoiceSingle",
            headline: { default: "Pick one", de: "Wähle eins" },
            required: true,
            showIf: unfinished("cl9dsxhzt0000qz0h5z6z6d01"),
            choices: [
              {
                id: "c1",
                label: { default: "A", de: "A" },
                showIf: unfinished("cl9dsxhzt0000qz0h5z6z6d02"),
              },
              { id: "c2", label: { default: "B", de: "B" } },
            ],
          },
        ],
      },
    ]);

    // The schema reports each of the two conditions twice; each is one problem.
    expect(
      getSchemaIssues(survey, t, "en-US").map(({ tab, targetId, field }) => ({ tab, targetId, field }))
    ).toEqual([
      { tab: "flow", targetId: "q2", field: "showIf" },
      { tab: "flow", targetId: "q2", field: "choices.0.showIf" },
    ]);
  });

  test("lists a block's own show-if on the Flow tab, against the block", () => {
    const condition = {
      id: "cl9dsxhzt0000qz0h5z6z6c01",
      connector: "and",
      conditions: [
        {
          id: "cl9dsxhzt0000qz0h5z6z6c02",
          leftOperand: { type: "element", value: "q1" },
          operator: "equals",
        },
      ],
    };
    const survey = buildSurvey([
      { id: "block1", name: "Block 1", elements: [openText({ default: "Name?", de: "Name?" })] },
      {
        id: "block2",
        name: "Block 2",
        showIf: condition,
        elements: [{ ...openText({ default: "Age?", de: "Alter?" }), id: "q2" }],
      },
    ]);

    expect(getSchemaIssues(survey, t, "en-US")).toEqual([
      expect.objectContaining({ tab: "flow", targetId: "block2", field: "showIf" }),
    ]);
  });

  test("says a rule's unfinished condition in the author's words, against the rule", () => {
    const survey = buildSurvey([
      {
        id: "block1",
        name: "Block 1",
        elements: [openText({ default: "Name?", de: "Name?" })],
        logic: [
          {
            id: "rule1",
            conditions: {
              id: "cl9dsxhzt0000qz0h5z6z6c01",
              connector: "and",
              conditions: [
                {
                  id: "cl9dsxhzt0000qz0h5z6z6c02",
                  leftOperand: { type: "element", value: "q1" },
                  operator: "equals",
                },
              ],
            },
            actions: [{ id: "cl9dsxhzt0000qz0h5z6z6c03", objective: "jumpToBlock", target: "block2" }],
          },
        ],
      },
      {
        id: "block2",
        name: "Block 2",
        elements: [{ ...openText({ default: "Age?", de: "Alter?" }), id: "q2" }],
      },
    ]);

    expect(getSchemaIssues(survey, t, "en-US")).toEqual([
      expect.objectContaining({
        tab: "flow",
        targetId: "rule1",
        message: "workspace.surveys.edit.issue_show_if_value",
      }),
    ]);
  });

  test("keeps duplicate choice labels out of the missing-translation count", () => {
    const survey = buildSurvey([
      block([
        {
          id: "q1",
          type: "multipleChoiceSingle",
          headline: { default: "Pick one", de: "Wähle eins" },
          required: true,
          shuffleOption: "none",
          choices: [
            { id: "c1", label: { default: "A", de: "Gleich" } },
            { id: "c2", label: { default: "B", de: "Gleich" } },
          ],
        },
      ]),
    ]);

    const issues = getSchemaIssues(survey, t, "en-US");

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((found) => found.tab === "language")).toBe(false);
    expect(issues[0]).toMatchObject({ tab: "elements", targetId: "q1" });
  });

  test("does not ask for a value when the operator takes none", () => {
    const survey = buildSurvey([
      {
        id: "block1",
        name: "Block 1",
        elements: [openText({ default: "Name?", de: "Name?" })],
      },
      {
        id: "block2",
        name: "Block 2",
        elements: [
          {
            ...openText({ default: "Age?", de: "Alter?" }),
            id: "q2",
            showIf: {
              id: "cl9dsxhzt0000qz0h5z6z6c01",
              connector: "and",
              conditions: [
                {
                  id: "cl9dsxhzt0000qz0h5z6z6c02",
                  leftOperand: { type: "element", value: "q1" },
                  operator: "isSubmitted",
                  rightOperand: { type: "static", value: "x" },
                },
              ],
            },
          },
        ],
      },
    ]);

    const found = getSchemaIssues(survey, t, "en-US").filter((entry) => entry.tab === "flow");

    expect(found.length).toBeGreaterThan(0);
    expect(found.some((entry) => entry.message.includes("issue_show_if_value"))).toBe(false);
  });

  test("puts a block's own button label problem on the block, against the label's field", () => {
    const survey = buildSurvey([
      {
        ...block([openText({ default: "Name?", de: "Name?" })]),
        buttonLabel: { default: 5, de: "Weiter" },
      },
    ]);

    expect(getSchemaIssues(survey, t, "en-US")).toEqual([
      expect.objectContaining({ tab: "elements", targetId: "block1", field: "buttonLabel" }),
    ]);
  });

  test("flags an empty block name on the block, not on a question", () => {
    const survey = buildSurvey([block([openText({ default: "Name?", de: "Name?" })], "")]);

    expect(getSchemaIssues(survey, t, "en-US")).toEqual([
      expect.objectContaining({
        targetId: "block1",
        field: "name",
        message: "workspace.surveys.edit.issue_enter_block_name",
      }),
    ]);
  });
});

describe("getSurveyRuleIssues", () => {
  beforeEach(() => {
    vi.mocked(checkForEmptyFallBackValue).mockReturnValue(null);
  });

  const base = buildSurvey([block([openText({ default: "Name?", de: "Name?" })])]);

  test("is quiet for a survey that passes", () => {
    expect(getSurveyRuleIssues({ survey: base, selectedLanguageCode: "en" }, t)).toEqual([]);
  });

  test("points an empty recall fallback at its question", () => {
    vi.mocked(checkForEmptyFallBackValue).mockReturnValue(openText({ default: "Q" }) as never);

    expect(getSurveyRuleIssues({ survey: base, selectedLanguageCode: "en" }, t)).toEqual([
      expect.objectContaining({
        targetId: "q1",
        field: "fallback",
        message: "workspace.surveys.edit.fallback_missing",
      }),
    ]);
  });

  test("refuses a response limit of 0 and one the survey has already reached", () => {
    const zero = { ...base, autoComplete: 0 } as TSurvey;
    const reached = { ...base, autoComplete: 5 } as TSurvey;

    expect(
      getSurveyRuleIssues({ survey: zero, selectedLanguageCode: "en", finishedResponseCount: 0 }, t)
    ).toEqual([
      expect.objectContaining({
        tab: "settings",
        field: "responseLimit",
        message: "workspace.surveys.edit.response_limit_can_t_be_set_to_0",
      }),
    ]);
    expect(
      getSurveyRuleIssues({ survey: reached, selectedLanguageCode: "en", finishedResponseCount: 5 }, t)
    ).toEqual([expect.objectContaining({ field: "responseLimit" })]);
    expect(
      getSurveyRuleIssues({ survey: reached, selectedLanguageCode: "en", finishedResponseCount: 4 }, t)
    ).toEqual([]);
  });

  test("needs a heading for the closed message of a link survey", () => {
    const survey = {
      ...base,
      surveyClosedMessage: { enabled: true, heading: "  ", subheading: "" },
    } as unknown as TSurvey;

    expect(getSurveyRuleIssues({ survey, selectedLanguageCode: "en" }, t)).toEqual([
      expect.objectContaining({ tab: "settings", field: "closedMessage" }),
    ]);
  });

  test("reports bad targeting filters of an app survey", () => {
    const survey = {
      ...base,
      type: "app",
      segment: {
        id: "temp",
        filters: [{ connector: "and", resource: { id: "invalid", name: "invalid", type: "invalid" } }],
        isPrivate: false,
        title: "temp",
        description: "",
        surveyId: "survey1",
      },
    } as unknown as TSurvey;

    expect(getSurveyRuleIssues({ survey, selectedLanguageCode: "en" }, t)).toEqual([
      expect.objectContaining({ tab: "settings", field: "targeting" }),
    ]);
  });
});

describe("collectEditorIssues", () => {
  beforeEach(() => {
    vi.mocked(checkForEmptyFallBackValue).mockReturnValue(null);
  });

  const appSurvey = buildSurvey([block([openText({ default: "Name?", de: "Name?" })])], {
    type: "app",
    triggers: [],
  });
  const context = {
    survey: appSurvey,
    selectedLanguageCode: "en",
    targetStatus: "inProgress" as const,
    isOpenedByCreative: false,
    isCustomCssBlocking: false,
    locale: "en-US",
  };

  test("lists every problem together: a missing trigger, bad Custom CSS and the schema's own", () => {
    const survey = buildSurvey([block([openText({ default: "", de: "Name?" })])], {
      type: "app",
      triggers: [],
    });

    const issues = collectEditorIssues({ ...context, survey, isCustomCssBlocking: true }, t);

    expect(issues.map((found) => found.field)).toEqual(["trigger", "customCss", "headline"]);
  });

  test("does not ask a draft for a trigger", () => {
    expect(collectEditorIssues({ ...context, targetStatus: "draft" }, t)).toEqual([]);
  });

  test("asks an app survey for a trigger when it is being published", () => {
    expect(collectEditorIssues(context, t)).toEqual([
      expect.objectContaining({ tab: "settings", field: "trigger" }),
    ]);
  });
});

describe("keeping issues in step with edits", () => {
  const headline = issue({ targetId: "q1", field: "headline" });
  const secondHeadline = issue({ targetId: "q2", field: "headline" });
  const trigger = issue({ tab: "settings", field: "trigger" });

  test("drops what was fixed", () => {
    expect(reconcileIssues([headline, secondHeadline], [secondHeadline])).toEqual([secondHeadline]);
  });

  test("does not flag a place that was not flagged: a question just added stays unmarked until the next publish", () => {
    expect(reconcileIssues([headline], [headline, secondHeadline])).toEqual([headline]);
  });

  test("keeps an issue with no card by its tab and field", () => {
    expect(
      reconcileIssues([trigger], [issue({ tab: "settings", field: "trigger", message: "new" })])
    ).toHaveLength(1);
    expect(reconcileIssues([trigger], [issue({ tab: "settings", field: "closedMessage" })])).toEqual([]);
  });

  test("tells a changed list from an unchanged one", () => {
    expect(areIssueListsEqual([headline], [{ ...headline }])).toBe(true);
    expect(areIssueListsEqual([headline], [secondHeadline])).toBe(false);
    expect(areIssueListsEqual([headline], [])).toBe(false);
  });

  test("lists each marked card once", () => {
    expect(
      getIssueTargetIds([headline, issue({ targetId: "q1", field: "subheader" }), secondHeadline, trigger])
    ).toEqual(["q1", "q2"]);
  });

  test("orders the summary by tab, keeping survey order inside a tab", () => {
    const language = issue({ tab: "language", languageCode: "de" });
    const flow = issue({ tab: "flow", targetId: "rule1" });

    expect(sortIssuesForSummary([language, trigger, flow, secondHeadline, headline])).toEqual([
      secondHeadline,
      headline,
      flow,
      trigger,
      language,
    ]);
  });

  test("counts the issues of each tab, in the order the summary lists the tabs", () => {
    const language = issue({ tab: "language", languageCode: "de" });
    const flow = issue({ tab: "flow", targetId: "rule1" });

    expect(countIssuesByTab([language, headline, flow, secondHeadline, trigger, headline])).toEqual([
      { tab: "elements", count: 3 },
      { tab: "flow", count: 1 },
      { tab: "settings", count: 1 },
      { tab: "language", count: 1 },
    ]);
  });

  test("counts nothing when there is nothing wrong", () => {
    expect(countIssuesByTab([])).toEqual([]);
  });

  test("finds the issue of one field of one card", () => {
    expect(getFieldIssue([headline, secondHeadline], "q2", "headline")).toBe(secondHeadline);
    expect(getFieldIssue([headline], "q1", "subheader")).toBeUndefined();
  });
});

describe("field keys", () => {
  test("maps an input id to the schema field it edits", () => {
    expect(toIssueFieldKey("choice-2")).toBe("choices.2.label");
    expect(toIssueFieldKey("row-0")).toBe("rows.0.label");
    expect(toIssueFieldKey("column-3")).toBe("columns.3.label");
    expect(toIssueFieldKey("headline")).toBe("headline");
    expect(toIssueFieldKey("otherOptionPlaceholder")).toBe("otherOptionPlaceholder");
  });

  test("knows which fields have an input to sit next to", () => {
    expect(isInlineIssueField("headline")).toBe(true);
    expect(isInlineIssueField("choices.1.label")).toBe(true);
    expect(isInlineIssueField("buttonUrl")).toBe(false);
    expect(isInlineIssueField(null)).toBe(false);
  });
});

describe("getPublishTargetStatus", () => {
  test("sends a draft live, or paused when it has a publish date", () => {
    expect(getPublishTargetStatus({ status: "draft", publishOn: null })).toBe("inProgress");
    expect(getPublishTargetStatus({ status: "draft", publishOn: new Date() })).toBe("paused");
  });

  test("keeps the status of a survey that is already live", () => {
    expect(getPublishTargetStatus({ status: "inProgress", publishOn: null })).toBe("inProgress");
    expect(getPublishTargetStatus({ status: "paused", publishOn: null })).toBe("paused");
  });
});
