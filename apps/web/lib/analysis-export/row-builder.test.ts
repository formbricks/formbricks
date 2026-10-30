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
    survey?: Partial<TAnalysisSurvey>;
  } = {}
) => {
  const builder = createAnalysisRowBuilder({
    survey: surveyWith(elements, options.survey),
    answers: options.answers ?? "codes",
    fields: options.fields ?? {},
  });
  const reports: unknown[] = [];
  const rows = responses.map((r) => builder.buildRow(r, (report) => reports.push(report)));
  const names = builder.columns.map((c) => c.name);
  const cells = (index = 0) =>
    Object.fromEntries(names.map((name, i) => [name, rows[index].codes?.[i] ?? null]));
  return { builder, rows, reports, names, cells };
};

describe("response columns", () => {
  test("response_id, language and outcome are always there; others only when selected", () => {
    const { names, cells } = run([colors], [response({ e1: "Red" }, { outcome: "lowQuality" })]);
    expect(names.slice(0, 3)).toEqual(["response_id", "language", "outcome"]);
    expect(cells()).toMatchObject({ response_id: "r1", language: "en", outcome: "lowQuality" });
    expect(names).not.toContain("timestamp");
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
