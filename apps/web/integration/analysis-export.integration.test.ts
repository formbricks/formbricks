/* eslint-disable turbo/no-undeclared-env-vars -- harness-only evidence switch, not app config */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test } from "vitest";
import { prisma } from "@formbricks/database";
import { resetDb } from "@/integration/reset-db";
import { type TAnalysisRow, UNMAPPED_PREFIX, openAnalysisExport } from "@/lib/analysis-export";

/**
 * The Analysis export service against real Postgres (ENG-6789): a coded, two-language survey with
 * answers in both languages, an option edited after answers came in, Other write-ins, an unanswered
 * question and two Low quality responses, read in batches of 4 so the cursor crosses pages.
 *
 * Set `ANALYSIS_EXPORT_EVIDENCE_DIR` to also write the seeded input and the service output as JSON.
 */

const l = (en: string, ar: string) => ({ default: en, ar });

const BLOCKS = [
  {
    id: "clbk1234567890123456789014",
    name: "Main",
    elements: [
      {
        id: "brand",
        code: "q1",
        type: "multipleChoiceSingle",
        headline: l("Which drink do you buy most?", "ما المشروب الذي تشتريه أكثر؟"),
        required: false,
        shuffleOption: "none",
        choices: [
          { id: "b1", code: "1", label: l("Cola", "كولا") },
          { id: "b2", code: "2", label: l("Juice", "عصير") },
          { id: "b3", code: "3", label: l("Water", "ماء") },
          { id: "other", code: "98", label: l("Other", "أخرى") },
        ],
      },
      {
        id: "snacks",
        code: "q2",
        type: "multipleChoiceMulti",
        headline: l("Which snacks do you eat?", "ما الوجبات الخفيفة التي تتناولها؟"),
        required: false,
        shuffleOption: "none",
        choices: [
          { id: "s1", code: "1", label: l("Chips", "رقائق") },
          { id: "s2", code: "2", label: l("Nuts", "مكسرات") },
          { id: "s3", code: "3", label: l("Fruit", "فاكهة") },
          { id: "other", code: "98", label: l("Other", "أخرى") },
        ],
      },
      {
        id: "rank",
        code: "q3",
        type: "ranking",
        headline: l("Rank what matters", "رتب ما يهم"),
        required: false,
        shuffleOption: "none",
        choices: [
          { id: "k1", code: "1", label: l("Price", "السعر") },
          { id: "k2", code: "2", label: l("Taste", "الطعم") },
          { id: "k3", code: "3", label: l("Pack", "العبوة") },
        ],
      },
      {
        id: "grid",
        code: "q4",
        type: "matrix",
        headline: l("Rate us", "قيمنا"),
        required: false,
        shuffleOption: "none",
        rows: [
          { id: "r1", code: "1", label: l("Service", "الخدمة") },
          { id: "r2", code: "2", label: l("Price", "السعر") },
        ],
        columns: [
          { id: "m1", code: "1", label: l("Good", "جيد") },
          { id: "m2", code: "2", label: l("Bad", "سيئ") },
        ],
      },
      { id: "nps", code: "q5", type: "nps", headline: l("Recommend?", "هل توصي؟"), required: false },
      {
        id: "stars",
        code: "q6",
        type: "rating",
        scale: "star",
        range: 5,
        headline: l("Stars", "نجوم"),
        required: false,
      },
      {
        id: "size",
        code: "q7",
        type: "multipleChoiceSingle",
        headline: l("Pack size", "حجم العبوة"),
        required: false,
        shuffleOption: "none",
        // "Large" was renamed after launch; older answers still say "Large".
        choices: [
          { id: "z1", code: "1", label: l("Small", "صغير") },
          { id: "z2", code: "2", label: l("Extra large", "كبير جدا") },
        ],
      },
      {
        id: "free",
        code: "q8",
        type: "openText",
        headline: l("Anything else?", "أي شيء آخر؟"),
        required: false,
        inputType: "text",
        charLimit: { enabled: false },
      },
    ],
  },
];

type TSeedResponse = {
  minute: number;
  language: string | null;
  outcome?: "lowQuality";
  data: Record<string, unknown>;
};

const RESPONSES: TSeedResponse[] = [
  {
    minute: 1,
    language: "en",
    data: {
      brand: "Cola",
      snacks: ["Chips", "Fruit"],
      rank: ["Taste", "Price"],
      grid: { Service: "Good", Price: "Bad" },
      nps: 9,
      stars: 4,
      size: "Small",
      free: "Great",
    },
  },
  {
    minute: 2,
    language: "ar",
    data: {
      brand: "عصير",
      snacks: ["مكسرات"],
      rank: ["العبوة", "السعر", "الطعم"],
      grid: { الخدمة: "جيد", السعر: "جيد" },
      nps: 10,
      stars: 5,
      size: "صغير",
      free: "ممتاز",
    },
  },
  {
    minute: 3,
    language: "en",
    data: { brand: "Kombucha", snacks: ["Chips", "", "Popcorn"], size: "Large", nps: 3 },
  },
  { minute: 4, language: "ar", data: { brand: "ماء", snacks: ["رقائق", "كعك"], grid: { الخدمة: "ربما" } } },
  { minute: 5, language: "en", data: { brand: "Water", snacks: [], nps: 0 } },
  { minute: 6, language: "en", outcome: "lowQuality", data: { brand: "Cola", snacks: ["Chips"], nps: 10 } },
  { minute: 7, language: "ar", data: { brand: "كولا", size: "كبير جدا", rank: ["السعر"] } },
  { minute: 8, language: "en", data: { brand: "Cola", size: "Large", grid: { Service: "Bad" } } },
  { minute: 9, language: "en", outcome: "lowQuality", data: { brand: "Juice", snacks: ["Nuts"] } },
  { minute: 10, language: "en", data: { size: "Extra large" } },
];

const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute, 0));

const seed = async (): Promise<string> => {
  const organization = await prisma.organization.create({ data: { name: "Export Org" } });
  const workspace = await prisma.workspace.create({
    data: { name: "Export Workspace", organizationId: organization.id },
  });
  const [en, ar] = await Promise.all([
    prisma.language.create({ data: { code: "en", workspaceId: workspace.id } }),
    prisma.language.create({ data: { code: "ar", workspaceId: workspace.id } }),
  ]);
  const survey = await prisma.survey.create({
    data: {
      name: "Drinks",
      type: "link",
      status: "inProgress",
      workspaceId: workspace.id,
      blocks: BLOCKS,
      languages: {
        create: [
          { languageId: en.id, default: true },
          { languageId: ar.id, default: false },
        ],
      },
    },
    select: { id: true },
  });
  await prisma.response.createMany({
    data: RESPONSES.map((response, index) => ({
      id: `resp-${String(index + 1).padStart(2, "0")}`,
      surveyId: survey.id,
      finished: true,
      createdAt: at(response.minute),
      language: response.language,
      outcome: response.outcome ?? null,
      data: response.data as object,
    })),
  });
  return survey.id;
};

const drain = async (surveyId: string, input: Parameters<typeof openAnalysisExport>[0]) => {
  const exported = await openAnalysisExport({ ...input, surveyId });
  const rows: TAnalysisRow[] = [];
  for await (const batch of exported.rows()) rows.push(...batch);
  return { exported, rows };
};

const cell = (
  exported: { columns: { name: string }[] },
  row: TAnalysisRow,
  name: string,
  view: "codes" | "labels" = "codes"
) => row[view]?.[exported.columns.findIndex((c) => c.name === name)];

describe("Analysis export against real Postgres", () => {
  let surveyId: string;

  beforeEach(async () => {
    await resetDb();
    surveyId = await seed();
  });

  test("leaves Low quality out by default, pages by cursor, and codes every answer", async () => {
    const { exported, rows } = await drain(surveyId, { surveyId, batchSize: 4, answers: "both" });

    expect(exported.counts).toEqual({ included: 8, lowQualityLeftOut: 2 });
    expect(rows.map((r) => r.responseId)).toEqual([
      "resp-10",
      "resp-08",
      "resp-07",
      "resp-05",
      "resp-04",
      "resp-03",
      "resp-02",
      "resp-01",
    ]);

    const by = (id: string) => rows.find((r) => r.responseId === id) as TAnalysisRow;
    const get = (id: string, name: string, view: "codes" | "labels" = "codes") =>
      cell(exported, by(id), name, view);

    // English and Arabic answers land on the same codes.
    expect(get("resp-01", "q1")).toBe("1");
    expect(get("resp-07", "q1")).toBe("1");
    expect(get("resp-02", "q1")).toBe("2");
    expect(get("resp-02", "q1", "labels")).toBe("عصير");
    expect(get("resp-04", "q1")).toBe("3");

    // Other write-in, and the same value in two spellings of "Other".
    expect(get("resp-03", "q1")).toBe("98");
    expect(get("resp-03", "q1_text")).toBe("Kombucha");

    // Multi select: 1 / 0 / blank, Other text.
    expect(get("resp-01", "q2_1")).toBe(1);
    expect(get("resp-01", "q2_2")).toBe(0);
    expect(get("resp-01", "q2_3")).toBe(1);
    expect(get("resp-02", "q2_2")).toBe(1);
    expect(get("resp-03", "q2_98")).toBe(1);
    expect(get("resp-03", "q2_98_text")).toBe("Popcorn");
    expect(get("resp-05", "q2_1")).toBeNull();
    expect(get("resp-07", "q2_1")).toBeNull();

    // Ranking, matrix, scales.
    expect(get("resp-02", "q3_3")).toBe(1);
    expect(get("resp-02", "q3_1")).toBe(2);
    expect(get("resp-01", "q3_3")).toBeNull();
    expect(get("resp-02", "q4_1")).toBe("1");
    expect(get("resp-01", "q4_2")).toBe("2");
    expect(get("resp-05", "q5")).toBe(0);
    expect(get("resp-02", "q6")).toBe(5);

    // The option renamed after answers came in: unmapped, kept as given.
    expect(get("resp-03", "q7")).toBe(`${UNMAPPED_PREFIX}Large`);
    expect(get("resp-07", "q7")).toBe("2");
    expect(get("resp-10", "q7")).toBe("2");

    // Low quality never appears.
    expect(rows.some((r) => r.responseId === "resp-06" || r.responseId === "resp-09")).toBe(false);

    const { unmapped, rowCount } = exported.summary();
    expect(rowCount).toBe(8);
    const byColumn = (column: string, value: string) =>
      unmapped.find((entry) => entry.column === column && entry.value === value);
    expect(byColumn("q7", "Large")).toMatchObject({
      responseCount: 2,
      languages: ["en"],
      responseIds: expect.arrayContaining(["resp-03", "resp-08"]),
      closest: { code: "2", label: "Extra large" },
    });
    // q2 has an Other option, so an Arabic write-in is Other text, not an Unmapped value.
    expect(byColumn("q2", "كعك")).toBeUndefined();
    expect(get("resp-04", "q2_98_text")).toBe("كعك");
    expect(byColumn("q4_1", "ربما")).toMatchObject({ responseIds: ["resp-04"] });

    if (process.env.ANALYSIS_EXPORT_EVIDENCE_DIR) {
      const dir = process.env.ANALYSIS_EXPORT_EVIDENCE_DIR;
      mkdirSync(dir, { recursive: true });
      const write = (name: string, value: unknown) =>
        writeFileSync(join(dir, name), `${JSON.stringify(value, null, 2)}\n`);
      write("input-survey-blocks.json", BLOCKS);
      write("input-responses.json", RESPONSES);
      write("output-columns.json", exported.columns);
      write("output-rows.json", { columns: exported.columns.map((c) => c.name), rows });
      write("output-summary.json", { counts: exported.counts, ...exported.summary() });
    }
  });

  test("a filter that selects Low quality exports only those", async () => {
    const { exported, rows } = await drain(surveyId, { surveyId, filter: { outcome: "lowQuality" } });
    expect(exported.counts).toEqual({ included: 2, lowQualityLeftOut: 0 });
    expect(rows.map((r) => cell(exported, r, "outcome"))).toEqual(["lowQuality", "lowQuality"]);
  });

  test("Finished filter and Low quality default compose", async () => {
    const { exported } = await drain(surveyId, { surveyId, filter: { finished: true } });
    expect(exported.counts).toEqual({ included: 8, lowQualityLeftOut: 2 });
  });
});
