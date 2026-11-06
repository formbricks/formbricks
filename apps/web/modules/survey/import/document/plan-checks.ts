import type { TImportCallFailure, TImportCheckedPlan, TImportPlanResponse } from "../core/ai-plan";
import { normalizeImportLanguageCode } from "../core/language-codes";
import {
  addPlanFailure,
  cleanRuleNotes,
  collectPlanEntries,
  collectPlanSkips,
  isImportPlanRange,
  judgePlanRef,
} from "../core/plan-checks";
import {
  SURVEY_IMPORT_DOCUMENT_MAX_ENTRY_LINES,
  SURVEY_IMPORT_MAX_NAME_CHARS,
  SURVEY_IMPORT_PLAN_MAX_RANKING_OPTIONS,
} from "../limits";
import type { TDocumentModel } from "./model";
import {
  DOCUMENT_PLAN_FORM_FIELDS,
  DOCUMENT_PLAN_KINDS,
  type TDocumentPlanEntry,
  type TDocumentPlanFormField,
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

const ALLOWED_KINDS: ReadonlySet<string> = new Set(DOCUMENT_PLAN_KINDS);
const CHOICE_KINDS: ReadonlySet<TDocumentPlanKind> = new Set([
  "multipleChoiceSingle",
  "multipleChoiceMulti",
  "ranking",
]);
const LABEL_KINDS: ReadonlySet<TDocumentPlanKind> = new Set(["rating", "csat", "ces", "nps"]);
/** The form kinds, whose options are the fields the file lists, each naming one of the kind's fields. */
const isFormKind = (kind: TDocumentPlanKind): kind is keyof typeof DOCUMENT_PLAN_FORM_FIELDS =>
  kind === "address" || kind === "contactInfo";

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
  | "invalid_range"
  | "invalid_field"
  | "silent_answer";

/** A text the file holds, in each of its languages, as the cells hold it (whitespace collapsed). */
export type TDocumentText = ReadonlyMap<string, string>;

export interface TDocumentPlannedOption {
  /** The code the file gives the option, verified in its cell; what routing compares with. */
  code: string | null;
  isOther: boolean;
  text: TDocumentText;
  /** The field an address or contact form's option is; `null` on any other kind. */
  field: TDocumentPlanFormField | null;
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
  /**
   * Answers that named none of the lines they were asked about. No failure (a chunk can hold only the
   * rest of a question), but such an answer says nothing about whether its lines are questions.
   */
  silentResponses: number;
  /** The lines those silent answers were asked about: a silent answer is no evidence they were read. */
  silentRefs: Set<string>;
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

  /**
   * The stored code a piece's language names: as the settling answer spelled it, or as another answer
   * spells the same language — calls are independent, and one says `en` where the first said `en-US`.
   * A bare language matches the one settled code of that language. `null` for a language the file was
   * not settled to hold.
   */
  codeOf(raw: string): string | null {
    const languages = this.languages;
    if (!languages) return null;
    const trimmed = raw.trim();
    const known = languages.byPlanCode.get(trimmed);
    if (known) return known;
    const normalized = normalizeImportLanguageCode(trimmed);
    if (normalized && languages.codes.includes(normalized)) return normalized;
    const primary = (code: string) => code.split(/[-_]/u)[0].toLowerCase();
    const sameLanguage = languages.codes.filter((code) => primary(code) === primary(trimmed));
    return sameLanguage.length === 1 ? sameLanguage[0] : null;
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
    (piece) =>
      context.languages !== null && context.codeOf(piece.language) === context.languages.defaultLanguage
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
  const text = new Map<string, string>();
  for (const piece of pieces) {
    const code = context.codeOf(piece.language);
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

/**
 * A label cell's text, when its line is within `lines`: the entry's own lines for its ID, which names the
 * question and routes to it, never a line before the question starts (an ID two questions still share is
 * not routed by, `assemble.ts`); any line up to the entry's first for its section, which a heading above
 * it names.
 */
const labelText = (
  context: DocumentPlanContext,
  key: string | null,
  lines: { first: number; last: number }
): string | null => {
  if (key === null) return null;
  const line = context.cellLineAt(key);
  const text = context.model.cells.get(key);
  if (line === undefined || text === undefined || line < lines.first || line > lines.last) return null;
  const collapsed = collapseWhitespace(text);
  return collapsed.length > 0 ? collapsed.slice(0, SURVEY_IMPORT_MAX_NAME_CHARS) : null;
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
    return { code: hasCode ? code : null, isOther: option.isOther, text, field: option.field };
  });

/** Whether the entry uses a role its kind has no place for: options, columns, labels, an "Other". */
const usesRoleNotForKind = (kind: TDocumentPlanKind, entry: TDocumentPlanEntry): boolean => {
  const usesOptions = CHOICE_KINDS.has(kind) || kind === "matrix" || isFormKind(kind);
  const takesOther = kind === "multipleChoiceSingle" || kind === "multipleChoiceMulti";
  return (
    (!usesOptions && entry.options.length > 0) ||
    (kind !== "matrix" && entry.columns.length > 0) ||
    (!LABEL_KINDS.has(kind) && (entry.lowerLabel.length > 0 || entry.upperLabel.length > 0)) ||
    (!takesOther && entry.options.some((option) => option.isOther))
  );
};

/** Whether the entry has fewer options, or rows and columns, than its kind needs. */
const hasTooFewOptions = (kind: TDocumentPlanKind, entry: TDocumentPlanEntry): boolean =>
  (CHOICE_KINDS.has(kind) && entry.options.length < 2) ||
  (isFormKind(kind) && entry.options.length < 1) ||
  (kind === "matrix" && (entry.options.length < 1 || entry.columns.length < 2));

/** The kind's own rules on its options, ranges and labels. */
function checkShape(kind: TDocumentPlanKind, entry: TDocumentPlanEntry, fail: TFail): number | null {
  if (usesRoleNotForKind(kind, entry)) fail("role_not_for_type");
  if (hasTooFewOptions(kind, entry)) fail("too_few_options");
  if (kind === "ranking" && entry.options.length > SURVEY_IMPORT_PLAN_MAX_RANKING_OPTIONS)
    fail("too_many_options");
  if (isFormKind(kind)) {
    // Each option a field of the form's own, named once: a field shows one label.
    const allowed: ReadonlySet<string> = new Set(DOCUMENT_PLAN_FORM_FIELDS[kind]);
    const fields = entry.options.map((option) => option.field);
    if (
      fields.some((field) => field === null || !allowed.has(field)) ||
      new Set(fields).size !== fields.length
    )
      fail("invalid_field");
  }

  if (kind === "rating" || kind === "csat" || kind === "ces") {
    // A scale whose points the file does not give is the editor's default five, which every one of
    // these kinds takes: a thinking model left the range out of a CES on the retry, failing it twice.
    const range = entry.range === null ? 5 : Number(entry.range);
    if (!isImportPlanRange(kind, range)) fail("invalid_range");
    return range;
  }
  return null;
}

/** The headline as the whole cell, in each language: what an entry whose pieces did not hold becomes. */
const wholeCellHeadline = (
  context: DocumentPlanContext,
  entry: TDocumentPlanEntry,
  span: { first: number; last: number }
): { headline: Map<string, string>; cell: string; cells: Set<string> } | null => {
  const headline = new Map<string, string>();
  const cells = new Set<string>();
  let defaultCell: string | null = null;
  for (const piece of entry.headline) {
    const code = context.codeOf(piece.language);
    const text = context.model.cells.get(piece.cell);
    // Only the entry's own lines, as every other piece is read: a cell elsewhere is another entry's.
    const line = context.cellLineAt(piece.cell);
    const inSpan = line !== undefined && line >= span.first && line <= span.last;
    if (!code || text === undefined || !inSpan || headline.has(code)) continue;
    headline.set(code, collapseWhitespace(text));
    cells.add(piece.cell);
    if (code === context.languages?.defaultLanguage) defaultCell = piece.cell;
  }
  return defaultCell ? { headline, cell: defaultCell, cells } : null;
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
  const span = { first, last: first + SURVEY_IMPORT_DOCUMENT_MAX_ENTRY_LINES };

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
    label: labelText(context, entry.idCell, span),
    section: labelText(context, entry.sectionCell, { first: 0, last: first }),
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
    notes: cleanRuleNotes(entry.logicNotes),
    cells,
    unsplitCell: null,
  };
  if (reasons.size === 0) return { ok: true, entry: planned };

  // The retry was the split's last chance: the whole cell becomes the headline, reported (decision 17).
  if (retry && reasons.has("not_verbatim")) {
    const whole = wholeCellHeadline(context, entry, span);
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
          cells: whole.cells,
          unsplitCell: whole.cell,
        },
      };
    }
  }
  return { ok: false, reasons: [...reasons] };
}

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
  const plan: TDocumentCheckedPlan = {
    entries: new Map(),
    skipped: new Map(),
    failures: new Map(),
    silentResponses: 0,
    silentRefs: new Set(),
  };
  const addFailure = (ref: string, reason: TDocumentPlanFailure) =>
    addPlanFailure(plan.failures, ref, reason);

  const failAll = (refs: ReadonlySet<string>, reason: TDocumentPlanFailure) => {
    for (const ref of refs) addFailure(ref, reason);
  };

  // The languages are settled by the answer about the earliest lines, so the choice does not depend on
  // which call came back first.
  const ordered = [...responses].sort((a, b) => firstLine(context, a.refs) - firstLine(context, b.refs));
  for (const response of ordered) {
    const envelope = ZDocumentImportPlanEnvelope.safeParse(response.object);
    if (!envelope.success) {
      failAll(response.refs, "invalid_output");
      continue;
    }
    if (!context.settleLanguages(envelope.data.defaultLanguage, envelope.data.languages)) {
      failAll(response.refs, "invalid_languages");
      continue;
    }
    settleTitleCell(context, envelope.data.titleCell);
    judgeResponse(context, plan, envelope.data, response, round, addFailure);
  }
  return plan;
}

/** The first answer to name a title cell the file has sets it; later answers can't move it. */
const settleTitleCell = (context: DocumentPlanContext, titleCell: string | null): void => {
  if (context.titleCell !== null || titleCell === null) return;
  context.titleCell = context.model.cells.has(titleCell) ? titleCell : null;
};

const firstLine = (context: DocumentPlanContext, refs: ReadonlySet<string>): number =>
  Math.min(...[...refs].map((ref) => context.lineAt(ref) ?? Number.MAX_SAFE_INTEGER));

/**
 * An answer that named none of its lines. A thinking model sometimes plans a chunk in its thoughts and
 * returns an empty answer, so a silent answer is asked once more: by the core, in halves (`askedAgain`),
 * or here, by failing its lines for the retry round. A second silent answer is `believed`: the lines hold
 * no question start (a chunk of notes, or the rest of a question), not unread ones. A line an entry named
 * but the schema refused already has its failure.
 */
const recordSilentAnswer = (
  plan: TDocumentCheckedPlan,
  refs: ReadonlySet<string>,
  { believed }: { believed: boolean },
  addFailure: (ref: string, reason: TDocumentPlanFailure) => void
): void => {
  plan.silentResponses += 1;
  for (const ref of refs) {
    plan.silentRefs.add(ref);
    if (!believed && !plan.failures.has(ref)) addFailure(ref, "silent_answer");
  }
};

function judgeResponse(
  context: DocumentPlanContext,
  plan: TDocumentCheckedPlan,
  envelope: { questions: unknown[]; skipped: unknown[] },
  { refs, askedAgain }: Pick<TImportPlanResponse, "refs" | "askedAgain">,
  round: { retry: boolean },
  addFailure: (ref: string, reason: TDocumentPlanFailure) => void
): void {
  const entries = collectPlanEntries(envelope.questions, refs, ZDocumentPlanEntry, (ref) =>
    addFailure(ref, "invalid_entry")
  );
  const skips = collectPlanSkips(envelope.skipped, refs, ZDocumentPlanSkip);
  if (entries.size === 0 && skips.size === 0) {
    recordSilentAnswer(plan, refs, { believed: round.retry || askedAgain === true }, addFailure);
  }

  // A line that is no entry's start — a header, a continuation, a comment — is not a failure: the AI
  // decides which lines are questions.
  for (const ref of new Set([...entries.keys(), ...skips.keys()])) {
    if (plan.failures.has(ref)) continue;
    const verdict = judgePlanRef(entries.get(ref) ?? [], skips.get(ref) ?? []);
    if (verdict.kind === "failed") addFailure(ref, verdict.reason);
    else if (verdict.kind === "skipped") plan.skipped.set(ref, verdict.reason);
    else if (verdict.kind === "placed") judgeEntry(context, plan, ref, verdict.entry, round, addFailure);
    // `missing` cannot happen here: every ref comes from an entry or a skip of this answer.
  }
}

/** Check one placed entry, keeping it or recording why it fails. */
const judgeEntry = (
  context: DocumentPlanContext,
  plan: TDocumentCheckedPlan,
  ref: string,
  entry: TDocumentPlanEntry,
  round: { retry: boolean },
  addFailure: (ref: string, reason: TDocumentPlanFailure) => void
): void => {
  const result = checkEntry(context, entry, round);
  if (result.ok) plan.entries.set(ref, result.entry);
  else for (const reason of result.reasons) addFailure(ref, reason);
};

/**
 * Failures that say nothing about the line itself: the whole call's answer could not be read, named none of its lines, or its
 * languages could not be. Every line the call was asked about gets one, questions and notes alike.
 */
const CALL_FAILURES: ReadonlySet<string> = new Set([
  "invalid_output",
  "silent_answer",
  "invalid_languages",
  "ai_budget",
  "ai_timeout",
]);

/**
 * Whether a line was never read: every reason it failed was its whole call's, so nothing says whether it
 * is a question, a note or an option. Once the plan is merged, these are the lines a call never answered
 * for, and the import cannot tell how many questions they hold.
 */
export const isUnreadLine = (reasons: readonly string[]): boolean =>
  reasons.length > 0 && reasons.every((reason) => CALL_FAILURES.has(reason));

/**
 * The retry's failures, plus the first round's for each line the AI placed as a question there and the
 * retry left out: a document answer judges only the lines it names, so that line would otherwise have
 * no verdict and no line in the report. Not for a line whose first-round failure was the whole call's
 * and whose retry answer named other lines (a heading or an option line, rightly named nowhere), nor for
 * one an entry of the merged plan reads, which the retry placed as part of another question.
 */
const keepUnresolvedFailures = (
  first: TDocumentCheckedPlan,
  retry: TDocumentCheckedPlan,
  entries: TDocumentCheckedPlan["entries"],
  context: DocumentPlanContext
): TDocumentCheckedPlan["failures"] => {
  const failures = new Map(retry.failures);
  // Only the entries the draft keeps: one that loses its cells to an earlier entry reads nothing.
  const linesRead = new Set(
    orderedEntries(context, { entries }).entries.flatMap((entry) =>
      [...entry.cells].flatMap((cell) => {
        const line = context.cellLineAt(cell);
        return line === undefined ? [] : [line];
      })
    )
  );
  for (const [ref, reasons] of first.failures) {
    if (retry.entries.has(ref) || retry.skipped.has(ref) || failures.has(ref)) continue;
    // A line whose whole call failed is cleared by a retry answer that named others (it is a heading or
    // an option line), not by one that named nothing: that says nothing about it, so it stays unread.
    // A line that was only silent is the exception: silent twice, it is believed to hold no question.
    if (isUnreadLine(reasons) && !retry.silentRefs.has(ref)) continue;
    if (reasons.every((reason) => reason === "silent_answer") && retry.silentRefs.has(ref)) continue;
    const line = context.lineAt(ref);
    if (line !== undefined && linesRead.has(line)) continue;
    failures.set(ref, reasons);
  }
  return failures;
};

/** Merge a retry round into the first one: the retry's verdicts replace the first round's failures, for the lines it judged. */
export function mergeDocumentPlans(
  first: TDocumentCheckedPlan,
  retry: TDocumentCheckedPlan,
  context: DocumentPlanContext
): TDocumentCheckedPlan {
  const entries = new Map([...first.entries, ...retry.entries]);
  return {
    entries,
    skipped: new Map([...first.skipped, ...retry.skipped]),
    failures: keepUnresolvedFailures(first, retry, entries, context),
    silentResponses: first.silentResponses + retry.silentResponses,
    silentRefs: new Set([...first.silentRefs, ...retry.silentRefs]),
  };
}

/**
 * The planned entries in document order, each cell claimed once: an entry reading a cell an earlier
 * entry already read — a call that took the next lines, which it was shown as context, for its own
 * question's — loses to the earlier one. The lines of the entries that lost are returned too, so the
 * report names each one.
 */
export function orderedEntries(
  context: DocumentPlanContext,
  plan: Pick<TDocumentCheckedPlan, "entries">
): { entries: TDocumentPlannedEntry[]; overlapping: string[] } {
  const claimed = new Set<string>();
  const entries: TDocumentPlannedEntry[] = [];
  const overlapping: string[] = [];
  const inOrder = [...plan.entries.values()].sort(
    (a, b) => (context.lineAt(a.ref) ?? 0) - (context.lineAt(b.ref) ?? 0)
  );
  for (const entry of inOrder) {
    if ([...entry.cells].some((cell) => claimed.has(cell))) {
      overlapping.push(entry.ref);
      continue;
    }
    for (const cell of entry.cells) claimed.add(cell);
    entries.push(entry);
  }
  return { entries, overlapping };
}
