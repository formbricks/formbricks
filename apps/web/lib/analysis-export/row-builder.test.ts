import { describe, expect, test } from "vitest";
import { validateSurveyCodes } from "@formbricks/types/surveys/codes";
import { type TAnalysisResponse, type TAnalysisSurvey, createAnalysisRowBuilder } from "./row-builder";
import type { TAnalysisColumn, TAnalysisResponseFields } from "./types";

const i18n = (en: string, ar?: string) => (ar === undefined ? { default: en } : { default: en, ar });

const languages = [
  { default: true, enabled: true, language: { id: "l1", code: "en" } },
  { default: false, enabled: true, language: { id: "l2", code: "ar" } },
] as unknown as TAnalysisSurvey["languages"];

const choice = (id: string, code: string, en: string, ar?: string) => ({
  id,
  code,
  label: i18n(en, ar),
});

const element = (partial: Record<string, unknown>) => ({
  required: false,
  headline: i18n(String(partial.id)),
  ...partial,
});

const surveyWith = (
  elements: Record<string, unknown>[],
  extra: Partial<TAnalysisSurvey> = {}
): TAnalysisSurvey =>
  ({
    blocks: [{ id: "b1", name: "b", elements }],
    languages,
    embeddedFields: [],
    isVerifyEmailEnabled: false,
    isCaptureIpEnabled: false,
    ...extra,
  }) as unknown as TAnalysisSurvey;

const response = (
  data: TAnalysisResponse["data"],
  extra: Partial<TAnalysisResponse> = {}
): TAnalysisResponse => ({
  id: "r1",
  createdAt: new Date("2026-01-02T03:04:05Z"),
  finished: true,
  language: "en",
  outcome: null,
  data,
  ...extra,
});

const colors = element({
  id: "e1",
  code: "q1",
  type: "multipleChoiceSingle",
  headline: i18n("Colour?", "اللون؟"),
  choices: [
    choice("c1", "1", "Red", "أحمر"),
    choice("c2", "2", "Blue", "أزرق"),
    choice("c3", "3", "Green", "أخضر"),
  ],
});

const colorsWithOther = element({
  ...colors,
  choices: [...(colors as unknown as { choices: unknown[] }).choices, choice("other", "98", "Other", "آخر")],
});

const run = (
  elements: Record<string, unknown>[],
  responses: TAnalysisResponse[],
  options: {
    fields?: TAnalysisResponseFields;
    answers?: "codes" | "text" | "both";
    multiSelect?: "columns" | "cell";
    survey?: Partial<TAnalysisSurvey>;
  } = {}
) => {
  const builder = createAnalysisRowBuilder({
    survey: surveyWith(elements, options.survey),
    answers: options.answers ?? "codes",
    multiSelect: options.multiSelect,
    fields: options.fields ?? {},
  });
  const reports: unknown[] = [];
  const rows = responses.map((r) => builder.buildRow(r, (report) => reports.push(report)));
  const names = builder.columns.map((c) => c.name);
  const cells = (index = 0) =>
    Object.fromEntries(names.map((name, i) => [name, rows[index].codes?.[i] ?? null]));
  return { builder, rows, reports, names, cells };
};

/** A column of a one-question export with multi-selects written as one cell. */
const cellLayoutColumn = (questionElement: Record<string, unknown>, name: string) =>
  createAnalysisRowBuilder({
    survey: surveyWith([questionElement]),
    answers: "codes",
    multiSelect: "cell",
    fields: {},
  }).columns.find((column) => column.name === name);

describe("response columns", () => {
  test("response_id, language and outcome are always there; others only when selected", () => {
    const { names, cells } = run([colors], [response({ e1: "Red" }, { outcome: "lowQuality" })]);
    expect(names.slice(0, 3)).toEqual(["response_id", "language", "outcome"]);
    expect(cells()).toMatchObject({ response_id: "r1", language: "en", outcome: "lowQuality" });
    expect(names).not.toContain("timestamp");
  });

  test("the metadata fields do not add a second language column", () => {
    const { names } = run([colors], [response({ e1: "Red" })], { fields: { metadata: true } });
    expect(names.filter((name) => name.endsWith("language"))).toEqual(["language"]);
    expect(names).toContain("country");
  });

  test("selected fields add timestamp, finished, tags, contact and quotas columns", () => {
    const builder = createAnalysisRowBuilder({
      survey: surveyWith([colors]),
      answers: "codes",
      fields: { timestamp: true, finished: true, tags: true, contact: true, quotas: true },
      isQuotasAllowed: true,
    });
    const row = builder.buildRow(
      response({}, { tags: ["a", "b"], contact: { id: "c1", userId: "u1" }, quotas: ["Q1"] }),
      () => {}
    );
    const byName = Object.fromEntries(builder.columns.map((c, i) => [c.name, row.codes?.[i]]));
    expect(byName).toMatchObject({
      timestamp: "2026-01-02 03:04:05 UTC",
      finished: 1,
      tags: "a, b",
      user_id: "u1",
      contact_id: "c1",
      quotas: "Q1",
    });
  });

  test("contact attributes are one text column each, read from the response's own attributes", () => {
    const builder = createAnalysisRowBuilder({
      survey: surveyWith([colors]),
      answers: "codes",
      fields: { contactAttributes: true },
      contactAttributeKeys: ["plan", "firstName", "seats"],
    });
    const row = builder.buildRow(response({}, { contactAttributes: { plan: "pro", seats: 5 } }), () => {});
    const byName = Object.fromEntries(builder.columns.map((c, i) => [c.name, row.codes?.[i]]));
    expect(byName).toMatchObject({ person_plan: "pro", person_first_name: null, person_seats: "5" });
    expect(builder.columns.find((c) => c.name === "person_plan")).toMatchObject({
      kind: "text",
      embedded: { origin: "contact", label: "person.plan" },
    });
  });

  test("without the field there are no contact attribute columns", () => {
    const builder = createAnalysisRowBuilder({
      survey: surveyWith([colors]),
      answers: "codes",
      fields: {},
      contactAttributeKeys: ["plan"],
    });
    expect(builder.columns.map((c) => c.name)).not.toContain("person_plan");
  });

  test("the language column names the default language by its code, not 'default'", () => {
    const { cells } = run([colors], [response({}, { language: "default" })]);
    expect(cells().language).toBe("en");
  });
});

describe("single select", () => {
  test("Arabic and English answers to the same option give the same code", () => {
    const { cells } = run(
      [colors],
      [response({ e1: "Red" }), response({ e1: "أحمر" }, { id: "r2", language: "ar" })]
    );
    const second = run([colors], [response({ e1: "أحمر" }, { language: "ar" })]).cells();
    expect(cells().q1).toBe("1");
    expect(second.q1).toBe("1");
  });

  test("a renamed option leaves the old answer unmapped: UNMAPPED cell, listed, never other", () => {
    const renamed = element({
      ...colors,
      choices: [choice("c1", "1", "Crimson"), choice("c2", "2", "Blue")],
    });
    const { cells, reports } = run([renamed], [response({ e1: "Red" })]);
    expect(cells().q1).toBe("UNMAPPED:Red");
    expect(reports).toEqual([
      expect.objectContaining({
        column: "q1",
        value: "Red",
        reason: "no_match",
        responseId: "r1",
        language: "en",
      }),
    ]);
  });

  test("with an Other option a non-match is Other: its code plus a _text column", () => {
    const { names, cells, reports } = run([colorsWithOther], [response({ e1: "Purple" })]);
    expect(names).toEqual(expect.arrayContaining(["q1", "q1_text"]));
    expect(cells()).toMatchObject({ q1: "98", q1_text: "Purple" });
    expect(reports).toHaveLength(0);
  });

  test("without an Other option there is no _text column and a non-match is unmapped", () => {
    const { names, cells } = run([colors], [response({ e1: "Purple" })]);
    expect(names).not.toContain("q1_text");
    expect(cells().q1).toBe("UNMAPPED:Purple");
  });

  test("a text matching two options is unmapped as ambiguous", () => {
    const twins = element({
      ...colors,
      choices: [choice("a", "1", "Yes"), choice("b", "2", "Yes"), choice("c", "3", "No")],
    });
    const { cells, reports } = run([twins], [response({ e1: "Yes" })]);
    expect(cells().q1).toBe("UNMAPPED:Yes");
    expect(reports[0]).toMatchObject({ reason: "ambiguous" });
  });

  test("an unanswered question is blank", () => {
    expect(run([colors], [response({})]).cells().q1).toBeNull();
    expect(run([colors], [response({ e1: "" })]).cells().q1).toBeNull();
  });

  test("the text view keeps what the respondent saw where the code view holds a code", () => {
    const { rows, names } = run([colors], [response({ e1: "أحمر" }, { language: "ar" })], {
      answers: "both",
    });
    const index = names.indexOf("q1");
    expect(rows[0].codes?.[index]).toBe("1");
    expect(rows[0].labels?.[index]).toBe("أحمر");
  });

  test("answers 'text' builds only labels, 'codes' only codes", () => {
    expect(run([colors], [response({})], { answers: "text" }).rows[0].codes).toBeNull();
    expect(run([colors], [response({})], { answers: "codes" }).rows[0].labels).toBeNull();
  });

  test("an option added after launch carries a code through fillMissingCodes", () => {
    const uncoded = element({
      id: "e1",
      type: "multipleChoiceSingle",
      choices: [
        { id: "a", label: i18n("A") },
        { id: "b", label: i18n("B") },
      ],
    });
    const { cells, names } = run([uncoded], [response({ e1: "B" })]);
    expect(names).toContain("q1");
    expect(cells().q1).toBe("2");
  });
});

describe("multi select", () => {
  const hobbies = element({
    id: "e2",
    code: "q2",
    type: "multipleChoiceMulti",
    choices: [
      choice("h1", "1", "Reading", "القراءة"),
      choice("h2", "2", "Chess", "الشطرنج"),
      choice("h3", "3", "Golf", "الغولف"),
      choice("other", "98", "Other", "آخر"),
    ],
  });

  test("one column per option: 1 chosen, 0 answered without it, blank unanswered", () => {
    const { names, cells } = run(
      [hobbies],
      [response({ e2: ["Reading", "Golf"] }), response({}, { id: "r2" })]
    );
    expect(names).toEqual(expect.arrayContaining(["q2_1", "q2_2", "q2_3", "q2_98", "q2_98_text"]));
    expect(cells(0)).toMatchObject({ q2_1: 1, q2_2: 0, q2_3: 1, q2_98: 0, q2_98_text: null });
    expect(cells(1)).toMatchObject({ q2_1: null, q2_2: null, q2_3: null, q2_98: null });
  });

  test("an empty array is unanswered", () => {
    expect(run([hobbies], [response({ e2: [] })]).cells()).toMatchObject({ q2_1: null, q2_2: null });
  });

  test("matches across languages", () => {
    const { cells } = run([hobbies], [response({ e2: ["الشطرنج"] }, { language: "ar" })]);
    expect(cells()).toMatchObject({ q2_1: 0, q2_2: 1, q2_3: 0 });
  });

  test("Other text goes in q2_<code>_text; the sentinel without text still ticks Other", () => {
    const withText = run([hobbies], [response({ e2: ["Reading", "", "Painting"] })]).cells();
    expect(withText).toMatchObject({ q2_1: 1, q2_98: 1, q2_98_text: "Painting" });
    const sentinelOnly = run([hobbies], [response({ e2: [""] })]).cells();
    expect(sentinelOnly).toMatchObject({ q2_98: 1, q2_98_text: null, q2_1: 0 });
  });

  test("with no Other option an unmatched selection has no cell: only the unmapped list records it", () => {
    const noOther = element({
      ...hobbies,
      choices: (hobbies as unknown as { choices: { id: string }[] }).choices.slice(0, 3),
    });
    const { cells, reports, names } = run([noOther], [response({ e2: ["Reading", "Painting"] })]);
    expect(names.some((n) => n.startsWith("q2_98"))).toBe(false);
    expect(cells()).toMatchObject({ q2_1: 1, q2_2: 0, q2_3: 0 });
    expect(Object.values(cells())).not.toContain("UNMAPPED:Painting");
    expect(reports).toEqual([
      expect.objectContaining({ column: "q2", value: "Painting", reason: "no_match" }),
    ]);
  });
});

describe("multi select as one cell", () => {
  const hobbies = element({
    id: "e2",
    code: "q2",
    type: "multipleChoiceMulti",
    choices: [
      choice("h1", "1", "Reading", "القراءة"),
      choice("h2", "2", "Chess", "الشطرنج"),
      choice("h3", "3", "Golf", "الغولف"),
      choice("other", "98", "Other", "آخر"),
    ],
  });
  const asCell = { multiSelect: "cell" } as const;

  test("one cell with the chosen codes in option order, whatever order they were ticked in", () => {
    const { names, cells } = run(
      [hobbies],
      [response({ e2: ["Golf", "Reading"] }), response({}, { id: "r2" })],
      asCell
    );
    expect(names).toEqual(expect.arrayContaining(["q2", "q2_98_text"]));
    expect(names).not.toContain("q2_1");
    expect(cellLayoutColumn(hobbies, "q2")).toMatchObject({ kind: "codes" });
    expect(cells(0)).toMatchObject({ q2: "1; 3", q2_98_text: null });
    expect(cells(1)).toMatchObject({ q2: null, q2_98_text: null });
  });

  test("labels are the answers as given; Other is its text, which also fills its own column", () => {
    const { rows, names } = run(
      [hobbies],
      [response({ e2: ["الشطرنج", "", "Painting"] }, { language: "ar" })],
      { ...asCell, answers: "both" }
    );
    const at = (cells: unknown[] | null, name: string) => cells?.[names.indexOf(name)];
    expect(at(rows[0].codes, "q2")).toBe("2; 98");
    expect(at(rows[0].labels, "q2")).toBe("الشطرنج; Painting");
    expect(at(rows[0].codes, "q2_98_text")).toBe("Painting");
  });

  test("a selection that matches no option stays out of the cell and is listed", () => {
    const noOther = element({
      ...hobbies,
      choices: (hobbies as unknown as { choices: { id: string }[] }).choices.slice(0, 3),
    });
    const { cells, reports } = run([noOther], [response({ e2: ["Chess", "Painting"] })], asCell);
    expect(cells()).toMatchObject({ q2: "2" });
    expect(reports).toEqual([
      expect.objectContaining({ column: "q2", value: "Painting", reason: "no_match" }),
    ]);
  });

  test("a picture selection with several picks is one cell too; ranking keeps a column per option", () => {
    const pictures = element({
      id: "e9",
      code: "q9",
      type: "pictureSelection",
      allowMulti: true,
      choices: [
        { id: "p1", code: "1", imageUrl: "a.png" },
        { id: "p2", code: "2", imageUrl: "b.png" },
      ],
    });
    const ranking = element({ ...hobbies, id: "e3", code: "q3", type: "ranking" });
    const { names, cells, reports } = run(
      [pictures, ranking],
      [response({ e9: ["p2", "p1", "px"], e3: ["Chess"] })],
      asCell
    );
    expect(cells()).toMatchObject({ q9: "1; 2", q3_2: 1 });
    expect(names).not.toContain("q9_1");
    expect(reports).toEqual([expect.objectContaining({ column: "q9", value: "px", reason: "no_match" })]);
  });
});

describe("ranking", () => {
  const ranking = element({
    id: "e3",
    code: "q3",
    type: "ranking",
    choices: [
      choice("k1", "1", "Price"),
      choice("k2", "2", "Quality"),
      choice("k3", "3", "Speed"),
      choice("other", "98", "Other"),
    ],
  });

  test("one column per option holds the rank given, blank when unranked", () => {
    const { cells } = run([ranking], [response({ e3: ["Speed", "Price"] })]);
    expect(cells()).toMatchObject({ q3_3: 1, q3_1: 2, q3_2: null, q3_98: null });
  });

  test("a ranked Other keeps its rank and its text", () => {
    const { cells } = run([ranking], [response({ e3: ["Price", "Convenience"] })]);
    expect(cells()).toMatchObject({ q3_1: 1, q3_98: 2, q3_98_text: "Convenience" });
  });
});

describe("matrix", () => {
  const matrix = element({
    id: "e4",
    code: "q4",
    type: "matrix",
    rows: [
      { id: "r1", code: "1", label: i18n("Service", "الخدمة") },
      { id: "r2", code: "2", label: i18n("Price", "السعر") },
    ],
    columns: [
      { id: "m1", code: "1", label: i18n("Good", "جيد") },
      { id: "m2", code: "2", label: i18n("Bad", "سيئ") },
    ],
  });

  test("one column per row holding the chosen column's code, looked up by the response language", () => {
    const { names, cells } = run(
      [matrix],
      [response({ e4: { الخدمة: "جيد", السعر: "سيئ" } }, { language: "ar" })]
    );
    expect(names).toEqual(expect.arrayContaining(["q4_1", "q4_2"]));
    expect(cells()).toMatchObject({ q4_1: "1", q4_2: "2" });
  });

  test("default-language answers and unanswered rows", () => {
    expect(run([matrix], [response({ e4: { Service: "Bad" } })]).cells()).toMatchObject({
      q4_1: "2",
      q4_2: null,
    });
  });

  test("a column text that matches nothing is unmapped for that row's column", () => {
    const { cells, reports } = run([matrix], [response({ e4: { Service: "Meh" } })]);
    expect(cells().q4_1).toBe("UNMAPPED:Meh");
    expect(reports[0]).toMatchObject({ column: "q4_1", value: "Meh" });
  });
});

describe("numbers and the Standard cells", () => {
  const nps = element({ id: "n1", code: "nps", type: "nps" });
  const rating = element({ id: "n2", code: "q5", type: "rating", scale: "smiley", range: 5 });
  const csat = element({ id: "n3", code: "q6", type: "csat", scale: "star", range: 5 });
  const ces = element({ id: "n4", code: "q7", type: "ces", scale: "number", range: 7 });
  const age = element({ id: "n5", code: "age", type: "openText", inputType: "number" });
  const free = element({ id: "t1", code: "q8", type: "openText", inputType: "text" });
  const address = element({ id: "t2", code: "q9", type: "address" });
  const cta = element({ id: "t3", type: "cta" });

  test("scale questions and number inputs are numbers, with their range on the column", () => {
    const { cells, builder } = run(
      [nps, rating, csat, ces, age],
      [response({ n1: 9, n2: 4, n3: 5, n4: 7, n5: "42" })]
    );
    expect(cells()).toMatchObject({ nps: 9, q5: 4, q6: 5, q7: 7, age: 42 });
    expect(builder.columns.find((c: TAnalysisColumn) => c.name === "q7")?.scale).toEqual({ range: 7 });
    expect(builder.columns.find((c: TAnalysisColumn) => c.name === "nps")?.scale).toEqual({ range: 10 });
  });

  test("a score of 0 is a number, not blank", () => {
    expect(run([nps], [response({ n1: 0 })]).cells().nps).toBe(0);
  });

  test("a non-numeric score is an UNMAPPED cell and is listed", () => {
    const { cells, reports } = run([age], [response({ n5: "n/a" })]);
    expect(cells().age).toBe("UNMAPPED:n/a");
    expect(reports[0]).toMatchObject({ reason: "not_a_number" });
  });

  test("text, address and the like use the Standard cell under the question code; CTA is left out", () => {
    const { names, cells } = run(
      [free, address, cta],
      [response({ t1: "hello", t2: ["1 Main St", "Doha"] })]
    );
    expect(cells()).toMatchObject({ q8: "hello", q9: "1 Main St; Doha" });
    expect(names).toEqual(["response_id", "language", "outcome", "q8", "q9"]);
  });
});

describe("Embedded Data", () => {
  const field = (name: string, dataType: string, source: string, storageKey: string) => ({
    field: { name, dataType, source, key: null, locked: false },
    link: { storageKey },
  });

  test("typed columns; a name equal to an export column gets an ed_ prefix", () => {
    const embeddedFields = [
      field("outcome", "string", "ingested", "k1"),
      field("visits", "number", "ingested", "k2"),
      field("vip", "boolean", "ingested", "k3"),
      field("score", "number", "computed", "k4"),
    ] as unknown as TAnalysisSurvey["embeddedFields"];
    const builder = createAnalysisRowBuilder({
      survey: surveyWith([colors], { embeddedFields }),
      answers: "codes",
      fields: { embeddedData: true },
    });
    const row = builder.buildRow(
      response({ k1: "x", k2: "7", k3: "true" }, { variables: { k4: 12 } }),
      () => {}
    );
    const byName = Object.fromEntries(builder.columns.map((c, i) => [c.name, row.codes?.[i]]));
    expect(byName).toMatchObject({ ed_outcome: "x", visits: 7, vip: "true", score: 12, outcome: null });
    expect(builder.columns.find((c) => c.name === "visits")?.embedded).toMatchObject({ type: "number" });
  });

  test("a date field set by now() exports its full ISO timestamp, time included (ENG-6935)", () => {
    const embeddedFields = [
      field("checked_in_at", "date", "computed", "k5"),
      field("signup_date", "date", "ingested", "k6"),
    ] as unknown as TAnalysisSurvey["embeddedFields"];
    const builder = createAnalysisRowBuilder({
      survey: surveyWith([colors], { embeddedFields }),
      answers: "codes",
      fields: { embeddedData: true },
    });
    const row = builder.buildRow(
      response({ k6: "2026-11-01" }, { variables: { k5: "2026-11-04T10:12:30.000Z" } }),
      () => {}
    );
    const byName = Object.fromEntries(builder.columns.map((c, i) => [c.name, row.codes?.[i]]));
    // The export's date contract is the stored ISO value: a day stays a day, a timestamp keeps its time.
    expect(byName).toMatchObject({ checked_in_at: "2026-11-04T10:12:30.000Z", signup_date: "2026-11-01" });
    expect(builder.columns.find((c) => c.name === "checked_in_at")?.embedded).toMatchObject({ type: "date" });
  });
});

describe("column names", () => {
  test("every column of a survey the code validator accepts has its own name", () => {
    const hobbies = element({
      id: "e2",
      code: "q2",
      type: "multipleChoiceMulti",
      choices: [choice("h1", "1", "Reading"), choice("h2", "2", "Chess"), choice("other", "98", "Other")],
    });
    const grid = element({
      id: "e3",
      code: "grid",
      type: "matrix",
      rows: [choice("r1", "a", "Row A"), choice("r2", "b", "Row B")],
      columns: [choice("k1", "1", "Yes"), choice("k2", "2", "No")],
    });
    const elements = [colorsWithOther, hobbies, grid, element({ id: "e4", code: "q2_3", type: "openText" })];

    const { issues, names } = {
      issues: validateSurveyCodes({ blocks: [{ id: "b1", elements }] }),
      names: run(elements, [response({})], { fields: { embeddedData: true } }).names,
    };

    expect(issues).toEqual([]);
    expect(new Set(names).size).toBe(names.length);
  });

  test("the clash the validator refuses (`q2_1` as an option column and as a code) is the one that duplicates", () => {
    const hobbies = element({
      id: "e2",
      code: "q2",
      type: "multipleChoiceMulti",
      choices: [choice("h1", "1", "Reading")],
    });
    const elements = [hobbies, element({ id: "e4", code: "q2_1", type: "openText" })];

    expect(validateSurveyCodes({ blocks: [{ id: "b1", elements }] }).map((issue) => issue.kind)).toEqual([
      "clashes_export_column",
    ]);
  });
});

describe("recall in a headline", () => {
  test("is resolved with its fallback, like the Standard export, not written out as a token", () => {
    const greeting = element({
      id: "e5",
      code: "q5",
      type: "openText",
      headline: i18n("Hi #recall:name/fallback:friend#, how are you?"),
    });
    const { builder } = run([greeting], [response({})], {
      survey: {
        embeddedFields: [
          {
            field: { name: "name", dataType: "string", source: "ingested", key: null, locked: false },
            link: { storageKey: "name" },
          },
        ] as never,
      },
    });
    const headline = builder.columns.find((c) => c.name === "q5")?.question?.headline;
    expect(headline).toBeDefined();
    expect(headline).not.toContain("#recall:");
    expect(headline).toContain("how are you?");
  });
});

describe("not shown (ENG-6936)", () => {
  const hobbies = element({
    id: "e2",
    code: "q2",
    type: "multipleChoiceMulti",
    choices: [choice("h1", "1", "Reading"), choice("h2", "2", "Chess")],
  });
  const answers = { e1: "Red", e2: ["Reading"] };

  test("a question the record lists exports blank, even with an answer stored", () => {
    const { cells } = run([colors, hobbies], [response(answers, { notShown: { elements: ["e2"] } })]);

    expect(cells()).toMatchObject({ q1: "1", q2_1: null, q2_2: null });
  });

  test("every question of a block the record lists exports blank", () => {
    const { cells } = run([colors, hobbies], [response(answers, { notShown: { blocks: ["b1"] } })]);

    expect(cells()).toMatchObject({ q1: null, q2_1: null, q2_2: null });
  });

  test("a response without a record (unknown) keeps the current rule", () => {
    const { cells } = run([colors, hobbies], [response(answers, { notShown: null })]);

    expect(cells()).toMatchObject({ q1: "1", q2_1: 1, q2_2: 0 });
  });
});

describe("option bases (ENG-6937)", () => {
  const services = element({
    id: "e2",
    code: "q2",
    type: "multipleChoiceMulti",
    choices: [
      choice("netflix", "1", "Netflix"),
      choice("disney", "2", "Disney+"),
      choice("apple", "3", "Apple"),
    ],
  });
  const posters = element({
    id: "e3",
    code: "q3",
    type: "pictureSelection",
    allowMulti: true,
    choices: [
      { id: "pa", code: "1", imageUrl: "https://example.com/a.png" },
      { id: "pb", code: "2", imageUrl: "https://example.com/b.png" },
    ],
  });
  const grid = element({
    id: "e4",
    code: "q4",
    type: "matrix",
    rows: [choice("rn", "1", "Netflix"), choice("rd", "2", "Disney+")],
    columns: [choice("cp", "1", "Poor"), choice("cg", "2", "Good"), choice("cf", "3", "Fair")],
  });

  test("a multi-select option column is 1 when picked, 0 when shown but not picked, blank when not shown", () => {
    const { cells } = run(
      [services],
      [response({ e2: ["Netflix"] }, { notShown: { options: { e2: ["apple"] } } })]
    );

    expect(cells()).toMatchObject({ q2_1: 1, q2_2: 0, q2_3: null });
  });

  test("a stored pick of an option the record lists is blank too: it was not shown", () => {
    const { cells } = run(
      [services],
      [response({ e2: ["Netflix", "Apple"] }, { notShown: { options: { e2: ["apple"] } } })]
    );

    expect(cells()).toMatchObject({ q2_1: 1, q2_2: 0, q2_3: null });
  });

  test("multi-select pictures follow the same rule", () => {
    const { cells } = run([posters], [response({ e3: ["pa"] }, { notShown: { options: { e3: ["pb"] } } })]);

    expect(cells()).toMatchObject({ q3_1: 1, q3_2: null });
  });

  test("as one cell, an option not shown is left out of the codes", () => {
    const { cells } = run(
      [services],
      [response({ e2: ["Netflix", "Apple"] }, { notShown: { options: { e2: ["apple"] } } })],
      { multiSelect: "cell" }
    );

    expect(cells()).toMatchObject({ q2: "1" });
  });

  test("matrix cells of rows or columns not shown are blank", () => {
    const { cells } = run(
      [grid],
      [
        response(
          { e4: { Netflix: "Fair", "Disney+": "Good" } },
          { notShown: { rows: { e4: ["rd"] }, columns: { e4: ["cf"] } } }
        ),
      ]
    );

    expect(cells()).toMatchObject({ q4_1: null, q4_2: null });
  });

  test("a response without a record keeps today's rule", () => {
    const { cells } = run([services], [response({ e2: ["Netflix"] }, { notShown: null })]);

    expect(cells()).toMatchObject({ q2_1: 1, q2_2: 0, q2_3: 0 });
  });
});
