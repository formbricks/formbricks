import type { TImportCallFailure, TImportCheckedPlan, TImportPlanResponse } from "../core/ai-plan";
import { cleanNote } from "../core/clean-note";
import { normalizeImportLanguageCode } from "../core/language-codes";
import type { TDocumentModel } from "./model";
import {
  DOCUMENT_PLAN_KINDS,
  type TDocumentPlanEntry,
  type TDocumentPlanKind,
  type TDocumentPlanOption,
  type TDocumentPlanPiece,
  type TDocumentPlanRule,
  ZDocumentImportPlanEnvelope,
  ZDocumentPlanEntry,
  ZDocumentPlanSkip,
} from "./plan-schema";

/**
 * The code checks on a document import's AI plan (ENG-6852). The plan is untrusted output — the file
 * it was made from can say anything to the model — so nothing in it is used until it passes here:
 *
 * - each entry starts on a line its call was asked about, once; lines outside the call are ignored;
 * - every text it names is in a cell of its own lines, in a language the file has, and every piece it
 *   quotes is in that cell word for word, whitespace aside (`readText`). The text kept is the cell's;
 * - the kind is on the allowlist, and the options fit it (counts included);
 * - free text (notes, skip reasons) is cleaned and capped, for the report only.
 *
 * An entry that fails gets its reasons back for one retry. On the retry, an entry whose only problem is
 * a piece that is not in its cell is kept with its whole cell as the headline instead (decision 17).
 */

/**
 * Lines one entry may span after the one it starts on: a question whose options take a line each, or
 * a list under it. Past that, a cell belongs to some other entry.
 */
export const DOCUMENT_MAX_ENTRY_LINES = 30;

const ALLOWED_KINDS: ReadonlySet<string> = new Set(DOCUMENT_PLAN_KINDS);
const ALLOWED_RANGES: Record<"rating" | "csat" | "ces", readonly number[]> = {
  rating: [3, 4, 5, 6, 7, 10],
  csat: [5],
  ces: [5, 7],
};
const CHOICE_KINDS: ReadonlySet<TDocumentPlanKind> = new Set([
  "multipleChoiceSingle",
  "multipleChoiceMulti",
  "ranking",
]);
const LABEL_KINDS: ReadonlySet<TDocumentPlanKind> = new Set(["rating", "csat", "ces", "nps"]);
const MAX_RANKING_OPTIONS = 25;

export type TDocumentPlanFailure =
  | TImportCallFailure
  | "invalid_entry"
  | "invalid_languages"
  | "duplicate_ref"
  | "placed_and_skipped"
  | "type_not_allowed"
  | "foreign_cell"
  | "unknown_language"
  | "duplicate_language"
  | "not_verbatim"
  | "missing_headline"
  | "role_not_for_type"
  | "too_few_options"
  | "too_many_options"
  | "invalid_range";

/** A text the file holds, in each of its languages, as the cells hold it (whitespace collapsed). */
export type TDocumentText = ReadonlyMap<string, string>;

export interface TDocumentPlannedOption {
  /** The code the file gives the option, verified in its cell; what routing compares with. */
  code: string | null;
  isOther: boolean;
  text: TDocumentText;
}

export interface TDocumentPlannedEntry {
  ref: string;
  kind: TDocumentPlanKind;
  /** The question's ID as the file writes it (`VIS01`), for its element id and for routing. */
  label: string | null;
  /** The section heading the entry is in, as the file writes it. */
  section: string | null;
  required: boolean;
  headline: TDocumentText;
  subheader: TDocumentText | null;
  options: TDocumentPlannedOption[];
  columns: TDocumentPlannedOption[];
  lowerLabel: TDocumentText | null;
  upperLabel: TDocumentText | null;
  dropdown: boolean;
  inputType: NonNullable<TDocumentPlanEntry["inputType"]>;
  scale: NonNullable<TDocumentPlanEntry["scale"]>;
  range: number | null;
  format: NonNullable<TDocumentPlanEntry["format"]>;
  rules: TDocumentPlanRule[];
  notes: string[];
  /** Every cell the entry reads, so two entries never claim one. */
  cells: ReadonlySet<string>;
  /**
   * The cell imported whole as the headline because its pieces were not in it word for word on the
   * retry too; `null` when the plan's split held.
   */
  unsplitCell: string | null;
}

/** The languages the file holds, default first, as the v3 survey document stores their codes. */
export interface TDocumentLanguages {
  defaultLanguage: string;
  codes: string[];
  /** The plan's own spelling of each code (`ar`), to the stored one (`ar-EG`). */
  byPlanCode: ReadonlyMap<string, string>;
}

export interface TDocumentCheckedPlan extends TImportCheckedPlan<TDocumentPlanFailure> {
  entries: Map<string, TDocumentPlannedEntry>;
  /** Skipped by the AI, with its cleaned reason (or `null`). */
  skipped: Map<string, string | null>;
  failures: Map<string, TDocumentPlanFailure[]>;
}

/** Whitespace runs as one space, trimmed: what a piece and its cell are compared by, and what is kept. */
export const collapseWhitespace = (text: string): string => text.replaceAll(/\s+/gu, " ").trim();

/**
 * What the checks read besides the plan: the file's model, and the languages the plan said the file
 * has — settled by the first answer that names them, and held to on every call after.
 */
export class DocumentPlanContext {
  private readonly lineIndex = new Map<string, number>();
  private readonly cellLine = new Map<string, number>();
  languages: TDocumentLanguages | null = null;
  titleCell: string | null = null;

  constructor(readonly model: TDocumentModel) {
    model.lines.forEach((line, index) => {
      this.lineIndex.set(line.key, index);
      for (const cell of line.cells) this.cellLine.set(cell.key, index);
    });
  }

  /** The line's position in the document, or `undefined` for a key that is not a line. */
  lineAt(key: string): number | undefined {
    return this.lineIndex.get(key);
  }

  /** The position of the line a cell is on, or `undefined` for a key that is not a cell. */
  cellLineAt(key: string): number | undefined {
    return this.cellLine.get(key);
  }

  /** Settle the file's languages from the first usable answer. */
  settleLanguages(defaultLanguage: string, languages: readonly string[]): boolean {
    if (this.languages) return true;
    const byPlanCode = new Map<string, string>();
    const codes: string[] = [];
    for (const raw of [defaultLanguage, ...languages]) {
      const code = normalizeImportLanguageCode(raw);
      if (!code) continue;
      byPlanCode.set(raw.trim(), code);
      if (!codes.includes(code)) codes.push(code);
    }
    const stored = byPlanCode.get(defaultLanguage.trim());
    if (!stored) return false;
    this.languages = { defaultLanguage: stored, codes, byPlanCode };
    return true;
  }
}

type TFail = (reason: TDocumentPlanFailure) => void;

/**
 * Whether a text slot has a piece in the default language at all. A piece that is there but fails its
 * own check fails with that reason alone, so the retry is told what to fix, not two things.
 */
const hasDefaultPiece = (context: DocumentPlanContext, pieces: readonly TDocumentPlanPiece[]): boolean =>
  pieces.some(
    (piece) => context.languages?.byPlanCode.get(piece.language.trim()) === context.languages?.defaultLanguage
  );

/** The piece's text, found in its cell word for word, as the cell holds it; `null` when it is not there. */
const pieceText = (cellText: string, piece: TDocumentPlanPiece): string | null => {
  const cell = collapseWhitespace(cellText);
  if (piece.text === null) return cell;
  const quoted = collapseWhitespace(piece.text);
  // The quote and the cell are compared the same way, so a found quote is the cell's own text.
  return quoted.length > 0 && cell.includes(quoted) ? quoted : null;
};

/**
 * A text slot of an entry — its headline, an option — read from the cells its pieces name: one per
 * language, each in a cell of the entry's lines, each piece in its cell word for word. `null` for a
 * slot with no pieces.
 */
function readText(
  context: DocumentPlanContext,
  pieces: readonly TDocumentPlanPiece[],
  span: { first: number; last: number },
  cells: Set<string>,
  fail: TFail
): TDocumentText | null {
  if (pieces.length === 0) return null;
  const languages = context.languages;
  const text = new Map<string, string>();
  for (const piece of pieces) {
    const code = languages?.byPlanCode.get(piece.language.trim()) ?? null;
    if (code === null) {
      fail("unknown_language");
      continue;
    }
    if (text.has(code)) fail("duplicate_language");
    const line = context.cellLineAt(piece.cell);
    const cellText = context.model.cells.get(piece.cell);
    if (line === undefined || cellText === undefined || line < span.first || line > span.last) {
      fail("foreign_cell");
      continue;
    }
    cells.add(piece.cell);
    const found = pieceText(cellText, piece);
    if (found === null) fail("not_verbatim");
    else text.set(code, found);
  }
  return text;
}

/** A label cell's text, when it is a cell of the entry's lines (or, for a section, any line before). */
const labelText = (context: DocumentPlanContext, key: string | null, maxLine: number): string | null => {
  if (key === null) return null;
  const line = context.cellLineAt(key);
  const text = context.model.cells.get(key);
  if (line === undefined || text === undefined || line > maxLine) return null;
  const collapsed = collapseWhitespace(text);
  return collapsed.length > 0 ? collapsed : null;
};

const readOptions = (
  context: DocumentPlanContext,
  options: readonly TDocumentPlanOption[],
  span: { first: number; last: number },
  cells: Set<string>,
  fail: TFail
): TDocumentPlannedOption[] =>
  options.map((option) => {
    const text = readText(context, option.texts, span, cells, fail) ?? new Map<string, string>();
    if (!hasDefaultPiece(context, option.texts)) fail("missing_headline");
    // A code must be in one of the option's cells too: it is what routing compares with.
    const code = option.code === null ? null : collapseWhitespace(option.code);
    const hasCode =
      code !== null &&
      code.length > 0 &&
      option.texts.some((piece) =>
        collapseWhitespace(context.model.cells.get(piece.cell) ?? "").includes(code)
      );
    return { code: hasCode ? code : null, isOther: option.isOther, text };
  });

/** The kind's own rules on its options, ranges and labels. */
function checkShape(kind: TDocumentPlanKind, entry: TDocumentPlanEntry, fail: TFail): number | null {
  const usesOptions = CHOICE_KINDS.has(kind) || kind === "matrix";
  if (!usesOptions && entry.options.length > 0) fail("role_not_for_type");
  if (kind !== "matrix" && entry.columns.length > 0) fail("role_not_for_type");
  if (!LABEL_KINDS.has(kind) && (entry.lowerLabel.length > 0 || entry.upperLabel.length > 0)) {
    fail("role_not_for_type");
  }
  if (CHOICE_KINDS.has(kind) && entry.options.length < 2) fail("too_few_options");
  if (kind === "ranking" && entry.options.length > MAX_RANKING_OPTIONS) fail("too_many_options");
  if (kind === "matrix" && (entry.options.length < 1 || entry.columns.length < 2)) fail("too_few_options");
  if (
    kind !== "multipleChoiceSingle" &&
    kind !== "multipleChoiceMulti" &&
    entry.options.some((o) => o.isOther)
  ) {
    fail("role_not_for_type");
  }

  if (kind === "rating" || kind === "csat" || kind === "ces") {
    const range = entry.range === null ? null : Number(entry.range);
    if (range === null || !ALLOWED_RANGES[kind].includes(range)) fail("invalid_range");
    return range;
  }
  return null;
}

/** The headline as the whole cell, in each language: what an entry whose pieces did not hold becomes. */
const wholeCellHeadline = (
  context: DocumentPlanContext,
  entry: TDocumentPlanEntry
): { headline: Map<string, string>; cell: string } | null => {
  const headline = new Map<string, string>();
  let defaultCell: string | null = null;
  for (const piece of entry.headline) {
    const code = context.languages?.byPlanCode.get(piece.language.trim());
    const text = context.model.cells.get(piece.cell);
    if (!code || text === undefined || headline.has(code)) continue;
    headline.set(code, collapseWhitespace(text));
    if (code === context.languages?.defaultLanguage) defaultCell = piece.cell;
  }
  return defaultCell ? { headline, cell: defaultCell } : null;
};

type TEntryResult =
  | { ok: true; entry: TDocumentPlannedEntry }
  | { ok: false; reasons: TDocumentPlanFailure[] };

/** Whether one entry fits the file and its kind. On the retry, a split that did not hold falls back. */
export function checkEntry(
  context: DocumentPlanContext,
  entry: TDocumentPlanEntry,
  { retry }: { retry: boolean }
): TEntryResult {
  if (!ALLOWED_KINDS.has(entry.kind)) return { ok: false, reasons: ["type_not_allowed"] };
  const kind = entry.kind as TDocumentPlanKind;
  const first = context.lineAt(entry.ref);
  if (first === undefined) return { ok: false, reasons: ["foreign_cell"] };
  const span = { first, last: first + DOCUMENT_MAX_ENTRY_LINES };

  const reasons = new Set<TDocumentPlanFailure>();
  const fail: TFail = (reason) => reasons.add(reason);
  const cells = new Set<string>();
  const range = checkShape(kind, entry, fail);
  const headline = readText(context, entry.headline, span, cells, fail);
  if (!hasDefaultPiece(context, entry.headline)) fail("missing_headline");
  const subheader = readText(context, entry.subheader, span, cells, fail);
  const options = readOptions(context, entry.options, span, cells, fail);
  const columns = readOptions(context, entry.columns, span, cells, fail);
  const lowerLabel = readText(context, entry.lowerLabel, span, cells, fail);
  const upperLabel = readText(context, entry.upperLabel, span, cells, fail);

  const planned: TDocumentPlannedEntry = {
    ref: entry.ref,
    kind,
    label: labelText(context, entry.idCell, span.last),
    section: labelText(context, entry.sectionCell, first),
    required: kind === "welcome" || kind === "ending" ? false : entry.required,
    headline: headline ?? new Map(),
    subheader,
    options,
    columns,
    lowerLabel,
    upperLabel,
    dropdown: entry.dropdown,
    inputType: entry.inputType ?? "text",
    scale: entry.scale ?? "number",
    range,
    format: entry.format ?? "M-d-y",
    rules: kind === "welcome" || kind === "ending" ? [] : entry.rules,
    notes: entry.logicNotes.map(cleanNote).filter((note) => note.length > 0),
    cells,
    unsplitCell: null,
  };
  if (reasons.size === 0) return { ok: true, entry: planned };

  // The retry was the split's last chance: the whole cell becomes the headline, reported (decision 17).
  if (retry && reasons.has("not_verbatim")) {
    const whole = wholeCellHeadline(context, entry);
    if (whole) {
      const isScreen = kind === "welcome" || kind === "ending";
      return {
        ok: true,
        entry: {
          ...planned,
          kind: isScreen ? kind : "openText",
          inputType: "text",
          headline: whole.headline,
          subheader: null,
          options: [],
          columns: [],
          lowerLabel: null,
          upperLabel: null,
          range: null,
          cells: new Set(entry.headline.map((piece) => piece.cell)),
          unsplitCell: whole.cell,
        },
      };
    }
  }
  return { ok: false, reasons: [...reasons] };
}

const readRef = (entry: unknown): string | null =>
  typeof entry === "object" && entry !== null && "ref" in entry && typeof entry.ref === "string"
    ? entry.ref
    : null;

/**
 * Check one round of answers. Each answer is checked within the lines its call was asked about; an
 * entry starting anywhere else is ignored, so one call can never place, skip or claim the cells of a
 * line another call owns.
 */
export function checkDocumentPlanResponses(
  context: DocumentPlanContext,
  responses: TImportPlanResponse[],
  round: { retry: boolean }
): TDocumentCheckedPlan {
  const plan: TDocumentCheckedPlan = { entries: new Map(), skipped: new Map(), failures: new Map() };
  const addFailure = (ref: string, reason: TDocumentPlanFailure) => {
    const reasons = plan.failures.get(ref) ?? [];
    if (!reasons.includes(reason)) reasons.push(reason);
    plan.failures.set(ref, reasons);
  };

  // The languages are settled by the answer about the earliest lines, so the choice does not depend on
  // which call came back first.
  const ordered = [...responses].sort((a, b) => firstLine(context, a.refs) - firstLine(context, b.refs));
  for (const response of ordered) {
    const envelope = ZDocumentImportPlanEnvelope.safeParse(response.object);
    if (!envelope.success) {
      for (const ref of response.refs) addFailure(ref, "invalid_output");
      continue;
    }
    if (!context.settleLanguages(envelope.data.defaultLanguage, envelope.data.languages)) {
      for (const ref of response.refs) addFailure(ref, "invalid_languages");
      continue;
    }
    if (context.titleCell === null && envelope.data.titleCell !== null) {
      context.titleCell = context.model.cells.has(envelope.data.titleCell) ? envelope.data.titleCell : null;
    }
    judgeResponse(context, plan, envelope.data, response.refs, round, addFailure);
  }
  return plan;
}

const firstLine = (context: DocumentPlanContext, refs: ReadonlySet<string>): number =>
  Math.min(...[...refs].map((ref) => context.lineAt(ref) ?? Number.MAX_SAFE_INTEGER));

function judgeResponse(
  context: DocumentPlanContext,
  plan: TDocumentCheckedPlan,
  envelope: { questions: unknown[]; skipped: unknown[] },
  refs: ReadonlySet<string>,
  round: { retry: boolean },
  addFailure: (ref: string, reason: TDocumentPlanFailure) => void
): void {
  const entries = new Map<string, TDocumentPlanEntry[]>();
  for (const raw of envelope.questions) {
    const ref = readRef(raw);
    if (ref === null || !refs.has(ref)) continue;
    const parsed = ZDocumentPlanEntry.safeParse(raw);
    if (parsed.success) entries.set(ref, [...(entries.get(ref) ?? []), parsed.data]);
    else addFailure(ref, "invalid_entry");
  }
  const skips = new Map<string, string[]>();
  for (const raw of envelope.skipped) {
    const parsed = ZDocumentPlanSkip.safeParse(raw);
    if (!parsed.success || !refs.has(parsed.data.ref)) continue;
    skips.set(parsed.data.ref, [...(skips.get(parsed.data.ref) ?? []), parsed.data.reason]);
  }

  // A line that is no entry's start — a header, a continuation, a comment — is not a failure: the AI
  // decides which lines are questions.
  for (const ref of new Set([...entries.keys(), ...skips.keys()])) {
    if (plan.failures.has(ref)) continue;
    const entryList = entries.get(ref) ?? [];
    const skipList = skips.get(ref) ?? [];
    if (entryList.length > 1 || skipList.length > 1) addFailure(ref, "duplicate_ref");
    else if (entryList.length === 1 && skipList.length === 1) addFailure(ref, "placed_and_skipped");
    else if (skipList.length === 1) {
      const reason = cleanNote(skipList[0]);
      plan.skipped.set(ref, reason.length > 0 ? reason : null);
    } else {
      const result = checkEntry(context, entryList[0], round);
      if (result.ok) plan.entries.set(ref, result.entry);
      else for (const reason of result.reasons) addFailure(ref, reason);
    }
  }
}

/** Merge a retry round into the first one: the retry's verdicts replace the first round's failures. */
export function mergeDocumentPlans(
  first: TDocumentCheckedPlan,
  retry: TDocumentCheckedPlan
): TDocumentCheckedPlan {
  return {
    entries: new Map([...first.entries, ...retry.entries]),
    skipped: new Map([...first.skipped, ...retry.skipped]),
    failures: new Map(retry.failures),
  };
}

/**
 * The planned entries in document order, each cell claimed once: an entry reading a cell an earlier
 * entry already read — a call that took the next lines, which it was shown as context, for its own
 * question's — loses to the earlier one.
 */
export function orderedEntries(
  context: DocumentPlanContext,
  plan: TDocumentCheckedPlan
): TDocumentPlannedEntry[] {
  const claimed = new Set<string>();
  return [...plan.entries.values()]
    .sort((a, b) => (context.lineAt(a.ref) ?? 0) - (context.lineAt(b.ref) ?? 0))
    .filter((entry) => {
      if ([...entry.cells].some((cell) => claimed.has(cell))) return false;
      for (const cell of entry.cells) claimed.add(cell);
      return true;
    });
}
