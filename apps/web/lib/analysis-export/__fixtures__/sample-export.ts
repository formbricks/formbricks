/**
 * A small, realistic Analysis export built with the real row builder and unmapped collector, so the
 * writer tests (and their golden files) read what the service really produces. Pure: no database.
 * English and Arabic, a free-text answer with quotes and a line break, a long answer, two Unmapped
 * values (one a near miss, one far off), a multi-select (1/0 columns), a ranking, an NPS and coded
 * answers whose codes are plain integers with a leading zero.
 */
import { Readable } from "node:stream";
import { type TAnalysisSurvey, createAnalysisRowBuilder } from "../row-builder";
import type {
  TAnalysisExport,
  TAnalysisResponseFields,
  TAnalysisRow,
  TAnswerDisplay,
  TUnmappedValue,
} from "../types";
import { createUnmappedCollector } from "../unmapped-collector";

const i18n = (en: string, ar?: string) => (ar === undefined ? { default: en } : { default: en, ar });
const choice = (id: string, code: string, en: string, ar?: string) => ({ id, code, label: i18n(en, ar) });

export const LONG_ARABIC_TEXT = "مرحبا بكم في الاستبيان. ".repeat(40).trim();

const elements = [
  {
    id: "e1",
    type: "multipleChoiceSingle",
    code: "colour",
    required: false,
    headline: i18n("Which colour do you prefer?", "ما اللون الذي تفضله؟"),
    choices: [
      choice("c1", "1", "Red", "أحمر"),
      choice("c2", "2", "Blue", "أزرق"),
      choice("c3", "3", "Green", "أخضر"),
    ],
  },
  {
    id: "e2",
    type: "multipleChoiceMulti",
    code: "fruit",
    required: false,
    headline: i18n("Which fruit do you eat? (it's a long one)"),
    choices: [
      choice("f1", "apple", "Apple"),
      choice("f2", "banana", "Banana"),
      choice("f3", "cherry", "Cherry"),
    ],
  },
  {
    id: "e3",
    type: "multipleChoiceSingle",
    code: "region",
    required: false,
    headline: i18n("Where do you live?"),
    choices: [
      choice("r1", "01", "Central Province"),
      choice("r2", "02", "Western Province"),
      choice("r3", "98", "Eastern Province"),
    ],
  },
  {
    id: "e4",
    type: "nps",
    code: "nps",
    required: false,
    headline: i18n("How likely are you to recommend us?"),
  },
  {
    id: "e5",
    type: "openText",
    code: "feedback",
    required: false,
    inputType: "text",
    headline: i18n("Tell us more"),
  },
  {
    id: "e6",
    type: "ranking",
    code: "rank",
    required: false,
    headline: i18n("Rank these"),
    choices: [choice("k1", "price", "Price"), choice("k2", "speed", "Speed")],
  },
  {
    // A question written in Arabic: its default language is the survey's second language.
    id: "e7",
    type: "multipleChoiceSingle",
    code: "city",
    required: false,
    headline: { default: "في أي مدينة تسكن؟" },
    choices: [
      { id: "m1", code: "1", label: { default: "الرياض" } },
      { id: "m2", code: "2", label: { default: "جدة" } },
    ],
  },
];

export const sampleSurvey = {
  blocks: [{ id: "b1", name: "Block 1", elements }],
  languages: [
    { default: true, enabled: true, language: { id: "l1", code: "en" } },
    { default: false, enabled: true, language: { id: "l2", code: "ar" } },
  ],
  embeddedFields: [],
  isVerifyEmailEnabled: false,
  isCaptureIpEnabled: false,
} as unknown as TAnalysisSurvey;

const responses = [
  {
    id: "resp_1",
    createdAt: new Date("2026-03-01T10:00:00Z"),
    finished: true,
    language: "en",
    outcome: null,
    data: {
      e1: "Red",
      e2: ["Apple", "Cherry"],
      e3: "Central Province",
      e4: 9,
      e5: 'He said "hello"\r\nsecond line, with a comma',
      e6: ["Speed", "Price"],
      e7: "الرياض",
    },
  },
  {
    id: "resp_2",
    createdAt: new Date("2026-03-01T11:30:00Z"),
    finished: true,
    language: "ar",
    outcome: null,
    data: {
      e1: "أزرق",
      e2: ["Banana"],
      e3: "Somewhere else",
      e4: 3,
      e5: LONG_ARABIC_TEXT,
      e7: "جدة",
    },
  },
  {
    id: "resp_3",
    createdAt: new Date("2026-03-02T08:15:00Z"),
    finished: false,
    language: "en",
    outcome: null,
    data: { e3: "Western Provnce", e5: "=SUM(A1:A9)" },
  },
];

export const SAMPLE_FIELDS: TAnalysisResponseFields = { timestamp: true, finished: true };

/** The service's output for the sample survey, in the shape `openAnalysisExport` returns. */
export const buildSampleExport = (answers: TAnswerDisplay = "codes"): TAnalysisExport => {
  const builder = createAnalysisRowBuilder({ survey: sampleSurvey, answers, fields: SAMPLE_FIELDS });
  const collector = createUnmappedCollector();
  let rowCount = 0;
  const built: TAnalysisRow[] = responses.map((response) =>
    builder.buildRow(response as never, collector.add)
  );
  return {
    columns: builder.columns,
    counts: { included: responses.length, lowQualityLeftOut: 0 },
    // Two batches, so writers are shown to cope with more than one.
    rows: async function* () {
      for await (const batch of Readable.from([built.slice(0, 2), built.slice(2)])) {
        yield batch;
        rowCount += batch.length;
      }
    },
    summary: () => {
      const { unmapped, dropped } = collector.result();
      return { rowCount, unmapped: unmapped as TUnmappedValue[], unmappedDropped: dropped };
    },
  };
};
