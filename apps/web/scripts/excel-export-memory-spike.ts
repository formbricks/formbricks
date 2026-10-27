/**
 * Spike for ENG-6793: what does the Analysis export's Excel workbook cost in memory and time?
 *
 * Builds a synthetic export (realistic mix of cell kinds, Arabic open text, two data sheets) through the
 * real writer, `buildAnalysisWorkbook`, and prints one JSON line: rows, columns, cells, seconds, peak RSS
 * and peak sampled heap in MB, file size. Run one size per process so each peak is its own:
 *
 *   pnpm exec tsx scripts/excel-export-memory-spike.ts <rows> [columns=300] [display=both]
 *   node --max-old-space-size=1024 --import tsx scripts/excel-export-memory-spike.ts 25000
 *
 * The numbers behind `EXCEL_EXPORT_MAX_CELLS` are recorded next to that constant.
 */
import { buildAnalysisWorkbook } from "../lib/analysis-export/files";
import type {
  TAnalysisCell,
  TAnalysisColumn,
  TAnalysisExport,
  TAnalysisRow,
  TAnswerDisplay,
} from "../lib/analysis-export/types";

const rows = Number(process.argv[2] ?? 25_000);
const columnCount = Number(process.argv[3] ?? 300);
const display = (process.argv[4] ?? "both") as TAnswerDisplay;
const BATCH = 1000;

// Deterministic pseudo-random, so a run is repeatable.
let seed = 42;
const random = () => {
  seed = (seed * 1_664_525 + 1_013_904_223) % 4_294_967_296;
  return seed / 4_294_967_296;
};
const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)];

const ARABIC_WORDS = [
  "الخدمة",
  "ممتازة",
  "والسعر",
  "مناسب",
  "لكن",
  "التوصيل",
  "تأخر",
  "كثيرا",
  "أنصح",
  "بها",
  "شكرا",
  "لكم",
];
const LABELS = ["Strongly agree", "Agree", "Neither agree nor disagree", "Disagree", "Strongly disagree"];

type TKind = "code" | "flag" | "number" | "open" | "other";
const kindOf = (index: number): TKind => {
  const slot = index % 10;
  if (slot < 4) return "code";
  if (slot < 7) return "flag";
  if (slot < 8) return "number";
  if (slot < 9) return "open";
  return "other";
};

const columns: TAnalysisColumn[] = Array.from({ length: columnCount }, (_, index) => ({
  name: index === 0 ? "response_id" : `q${index}_${kindOf(index)}`,
  kind: "text",
  source: "question",
  question: { id: `q${index}`, code: `q${index}`, type: "openText", headline: `Question number ${index}` },
}));

const openText = (): string =>
  Array.from({ length: 8 + Math.floor(random() * 40) }, () => pick(ARABIC_WORDS)).join(" ");

const buildRow = (rowIndex: number): TAnalysisRow => {
  const codes: TAnalysisCell[] = [];
  const labels: TAnalysisCell[] = [];
  const id = `cm${rowIndex.toString(36).padStart(23, "0")}`;
  for (let index = 0; index < columnCount; index++) {
    if (index === 0) {
      codes.push(id);
      labels.push(id);
      continue;
    }
    // About 15% of the cells are blank: unanswered or not shown.
    if (random() < 0.15) {
      codes.push(null);
      labels.push(null);
      continue;
    }
    switch (kindOf(index)) {
      case "code": {
        const choice = Math.floor(random() * LABELS.length);
        codes.push(`0${choice + 1}`);
        labels.push(LABELS[choice]);
        break;
      }
      case "flag": {
        const flag = random() < 0.5 ? 1 : 0;
        codes.push(flag);
        labels.push(flag);
        break;
      }
      case "number": {
        const value = Math.floor(random() * 11);
        codes.push(value);
        labels.push(value);
        break;
      }
      default: {
        const text = openText();
        codes.push(text);
        labels.push(text);
      }
    }
  }
  return {
    responseId: id,
    codes: display === "text" ? null : codes,
    labels: display === "codes" ? null : labels,
  };
};

const exported: TAnalysisExport = {
  columns,
  counts: { included: rows, lowQualityLeftOut: 0 },
  rows: async function* () {
    for (let start = 0; start < rows; start += BATCH) {
      yield Array.from({ length: Math.min(BATCH, rows - start) }, (_, offset) => buildRow(start + offset));
      // Let the sampler run between batches.
      await new Promise((resolve) => setImmediate(resolve));
    }
  },
  summary: () => ({ rowCount: rows, unmapped: [], unmappedDropped: 0 }),
};

const MB = 1024 * 1024;
let peakHeap = 0;
const sample = () => {
  peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
};

const main = async () => {
  const timer = setInterval(sample, 25);
  const started = performance.now();
  const buffer = await buildAnalysisWorkbook(exported, {
    display,
    include: { datamap: false, unmappedValues: false },
  });
  const seconds = (performance.now() - started) / 1000;
  sample();
  clearInterval(timer);

  const sheets = display === "both" ? 2 : 1;
  console.log(
    JSON.stringify({
      node: process.version,
      rows,
      columns: columnCount,
      sheets,
      cells: sheets * columnCount * (rows + 1),
      seconds: Number(seconds.toFixed(1)),
      peakRssMb: Math.round(process.resourceUsage().maxRSS / 1024),
      peakHeapMb: Math.round(peakHeap / MB),
      fileMb: Number((buffer.length / MB).toFixed(1)),
    })
  );
};

void main();
