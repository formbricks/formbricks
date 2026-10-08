import { z } from "zod";
import { DEFAULT_V3_SURVEY_LANGUAGE } from "@/app/api/v3/surveys/schemas";
import { QsfImportInputError } from "./errors";
import { isObjectMemberName } from "./id-registry";
import { isReportableLanguageCode, normalizeQualtricsLanguageCode } from "./language-codes";
import {
  QSF_MAX_BLOCKS,
  QSF_MAX_BLOCK_ELEMENTS,
  QSF_MAX_EMBEDDED_DATA_FIELDS,
  QSF_MAX_FLOW_DEPTH,
  QSF_MAX_FLOW_NODES,
  QSF_MAX_HIDDEN_FIELDS,
  QSF_MAX_LANGUAGES,
  QSF_MAX_LANGUAGE_KEYS,
  QSF_MAX_LANGUAGE_KEYS_PER_QUESTION,
  QSF_MAX_LOGIC_TERMS,
  QSF_MAX_MARKUP_TEXTS,
  QSF_MAX_NAME_CHARS,
  QSF_MAX_OPTIONS_PER_QUESTION,
  QSF_MAX_QUESTIONS,
  QSF_MAX_TEXTS,
  QSF_MAX_TEXT_CHARS,
} from "./limits";
import { needsParsing } from "./markup";
import { collectEmbeddedDataReferences } from "./piped-text";
import type {
  TQsfIssue,
  TQsfLogicCondition,
  TQsfLogicRule,
  TQsfOption,
  TQsfPage,
  TQsfQuestion,
  TQsfSlider,
  TQsfSurvey,
  TQsfText,
  TQsfTextFormat,
  TQsfTextKey,
} from "./qsf-model";

/**
 * The Qualtrics reader (ENG-3654): a parsed `.qsf` in, the import's model out (`qsf-model.ts`).
 *
 * Synchronous and cheap on purpose — it runs before the stream opens, so a file it cannot read is a
 * 422, and it must not hold the event loop (≤ ~50 ms on the largest file). The costly work, sanitizing
 * the texts, is left for `runQsfImport`.
 *
 * QSF has no published schema and Qualtrics changes shapes between versions, so every value is read
 * defensively. Three rules hold throughout, because the file is untrusted input that already went
 * through `JSON.parse` (which keeps an own `__proto__` key as data):
 *
 * - a raw object is only ever read through `own()`, so `constructor` or `toString` never resolves to
 *   an inherited member;
 * - an id or language code from the file becomes a key only after a bounded pattern check, and only in
 *   a `Map`; a refused one becomes a report line;
 * - nothing recurses on the file: the flow walk is iterative and capped at `QSF_MAX_FLOW_DEPTH`, and
 *   logic is read at its fixed depth;
 * - every collection is counted against its limit before its entries are worked on — blocks and their
 *   entries, embedded data, options, `Language` keys — so a file past one costs a count, not the work;
 * - no string from the file is scanned past its bound: a name is cut before it is trimmed, and a text
 *   longer than `QSF_MAX_TEXT_CHARS` (which the sanitizer refuses) is never searched for piped text.
 */

/** Qualtrics question ids are `QID` and a number. Anything else is refused, `__proto__` included. */
const QUESTION_REF_PATTERN = /^QID[1-9]\d{0,8}$/;
/** Choice ids are numbers in every export seen; letters are tolerated, punctuation is not. */
const OPTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const TOKEN_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const MAX_LOGIC_VALUE_CHARS = 80;
const MAX_URL_CHARS = 2_000;
/** A message library reference (`MS_…`) is an id, never longer than this. */
const MAX_MESSAGE_REF_CHARS = 64;
const MESSAGE_REF_PATTERN = /^MS_[A-Za-z0-9]+$/;
/** Longest number read from a string: a 15 MB numeric string is not a slider bound. */
const MAX_NUMBER_CHARS = 32;

/**
 * The part of the envelope every Qualtrics export has, read before anything else. Strict about the
 * three keys it checks and blind to the rest: it never copies the file.
 */
const ZQsfEnvelope = z.object({
  SurveyEntry: z.object({
    SurveyName: z
      .string()
      .transform((name) => bounded(trimmedHead(name, 2 * QSF_MAX_NAME_CHARS), QSF_MAX_NAME_CHARS))
      .pipe(z.string().min(1)),
  }),
  SurveyElements: z.array(z.unknown()),
});

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** An own property only: never an inherited member, whatever the key. */
const own = (record: TRecord, key: string): unknown => (Object.hasOwn(record, key) ? record[key] : undefined);

const ownRecord = (record: TRecord, key: string): TRecord | null => {
  const value = own(record, key);
  return isRecord(value) ? value : null;
};

const str = (value: unknown): string | null => {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
};

const num = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.length <= MAX_NUMBER_CHARS &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  ) {
    return Number(value);
  }
  return null;
};

const isTrue = (value: unknown): boolean => value === true || value === "true";

/** A short token from the file (`MC`, `SAVR`, `Selected`), or `null` when it is anything else. */
const token = (value: unknown): string | null => {
  const text = str(value);
  return text !== null && TOKEN_PATTERN.test(text) ? text : null;
};

const bounded = (value: string, max: number): string => (value.length > max ? value.slice(0, max) : value);

/** `value`'s first `max` characters, trimmed: the work is bounded by the cut, never by the file. */
const trimmedHead = (value: string, max: number): string => bounded(value, max).trim();

/** An export tag from the file, cut and trimmed, or `null` when there is none. */
const exportTagOf = (payload: TRecord): string | null => {
  const raw = str(own(payload, "DataExportTag"));
  const tag = raw === null ? "" : bounded(trimmedHead(raw, 2 * QSF_MAX_NAME_CHARS), QSF_MAX_NAME_CHARS);
  return tag.length > 0 ? tag : null;
};

const inputError = (name: string, reason: string): QsfImportInputError =>
  new QsfImportInputError([{ name, reason }]);

interface TRawQuestion {
  ref: string;
  elementIndex: number;
  payload: TRecord;
  secondaryAttribute: string | null;
}

interface TRawBlock {
  id: string;
  name: string;
  isTrash: boolean;
  /** Question refs, with `null` for a page break. */
  elements: (string | null)[];
}

interface TReadElements {
  questions: Map<string, TRawQuestion>;
  blocks: Map<string, TRawBlock>;
  flow: { index: number; nodes: unknown[] } | null;
  options: TRecord | null;
}

/** One open level of the flow walk: its elements, where it is, and the rule gating it, if any. */
interface TFlowFrame {
  nodes: unknown[];
  next: number;
  depth: number;
  gate: { rule: TQsfLogicRule; attached: boolean } | null;
}

/** A finished level of the flow: a rule that gated no block goes on the page before it. */
function closeFlowFrame(frame: TFlowFrame, result: TFlowResult): void {
  if (frame.gate && !frame.gate.attached) {
    result.trailingGates.push({ afterVisit: result.visits.length - 1, rule: frame.gate.rule });
  }
}

/**
 * A block the flow shows, the first time it does. It takes every rule of the levels it sits in that
 * has gated no block yet.
 */
function visitBlock(
  blockId: string | null,
  stack: readonly TFlowFrame[],
  visited: Set<string>,
  result: TFlowResult
): void {
  if (blockId === null || visited.has(blockId)) return;
  visited.add(blockId);

  const gates: TQsfLogicRule[] = [];
  for (const open of stack) {
    if (open.gate && !open.gate.attached) {
      open.gate.attached = true;
      gates.push(open.gate.rule);
    }
  }
  result.visits.push({ blockId, gates });
}

/**
 * An option list's ids in display order: `ChoiceOrder` first (ids as strings or numbers), then any the
 * order leaves out, each once and only when the list has it. Refused at the first id past the limit,
 * before any option is read.
 */
function optionIds(records: TRecord, order: unknown, tooMany: () => Error): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const consider = (id: string) => {
    if (seen.has(id) || !Object.hasOwn(records, id)) return;
    seen.add(id);
    ids.push(id);
    if (ids.length > QSF_MAX_OPTIONS_PER_QUESTION) throw tooMany();
  };
  if (Array.isArray(order)) {
    for (const id of order) if (str(id) !== null) consider(String(id));
  }
  for (const id of Object.keys(records)) consider(id);
  return ids;
}

/** How an expression joins the one before it, when it has one before it and says `And` or `Or`. */
const readConjunction = (expression: TRecord, joined: boolean): Pick<TQsfLogicCondition, "conjunction"> => {
  const conjunction = token(own(expression, "Conjuction"))?.toLowerCase();
  return joined && (conjunction === "and" || conjunction === "or") ? { conjunction } : {};
};

/** The value an expression compares with, cut to its bound. */
const readCompared = (expression: TRecord): Pick<TQsfLogicCondition, "value"> => {
  const right = str(own(expression, "RightOperand"));
  return right === null ? {} : { value: bounded(right, MAX_LOGIC_VALUE_CHARS) };
};

/** An element the file holds at most once, read; a second one is refused. */
const readOnce = <T>(current: T | null, index: number, what: string, read: () => T): T => {
  if (current !== null) throw inputError(`qsf.SurveyElements.${index}`, `The file has two ${what}`);
  return read();
};

/** The survey flow's top-level elements. */
const flowNodes = (payload: unknown): unknown[] => {
  const nodes = isRecord(payload) ? own(payload, "Flow") : null;
  return Array.isArray(nodes) ? nodes : [];
};

const surveyOptions = (payload: unknown): TRecord => (isRecord(payload) ? payload : {});

/** A block list's entries: the array itself, or an older export's object keyed by index. */
const blockEntries = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload)) return Object.keys(payload).map((key) => payload[key]);
  return [];
};

interface TFlowVisit {
  blockId: string;
  gates: TQsfLogicRule[];
}

interface TFlowResult {
  visits: TFlowVisit[];
  embeddedDataNames: string[];
  /** Branch and randomizer rules gating no block: attached to the page before them. */
  trailingGates: { afterVisit: number; rule: TQsfLogicRule }[];
}

class QsfReader {
  private readonly issues: TQsfIssue[] = [];
  private readonly texts = new Map<TQsfTextKey, TQsfText>();
  private readonly counters = { t: 0, c: 0, a: 0, b: 0, s: 0 };
  private readonly languageByRaw = new Map<string, string | null>();
  private readonly reportedLanguages = new Set<string>();
  private readonly translationLanguages = new Set<string>();
  /** Raw `Language` keys read so far, all questions together. */
  private languageKeyCount = 0;
  /** Block list entries read so far. */
  private blockElementCount = 0;
  /** Embedded data fields the flow sets, read so far. */
  private embeddedDataFieldCount = 0;
  /** Texts read so far, each language of a text counted, and those with markup among them. */
  private textCount = 0;
  private markupTextCount = 0;
  /** Per question, Qualtrics choice id → text key, for logic and translations. */
  private readonly choiceKeysByRef = new Map<string, Map<string, TQsfTextKey>>();
  /** Branch rules are met before the questions they read, so their conditions are read last. */
  private readonly pendingBranchLogic = new Map<TQsfLogicRule, unknown>();
  private defaultLanguage: string = DEFAULT_V3_SURVEY_LANGUAGE;

  read(qsf: TRecord): TQsfSurvey {
    const envelope = ZQsfEnvelope.safeParse(qsf);
    if (!envelope.success) {
      throw new QsfImportInputError(
        envelope.error.issues.map((issue) => ({
          name: ["qsf", ...issue.path.map(String)].join("."),
          reason: issue.message,
        }))
      );
    }

    const surveyEntry = ownRecord(qsf, "SurveyEntry") ?? {};
    this.defaultLanguage = this.readDefaultLanguage(own(surveyEntry, "SurveyLanguage"));

    const {
      questions: rawQuestions,
      blocks,
      flow,
      options,
    } = this.readElements(envelope.data.SurveyElements);
    const flowResult = this.walkFlow(flow);
    const pages = this.buildPages(flowResult, blocks, rawQuestions);

    const questions = new Map<string, TQsfQuestion>();
    let position = 0;
    for (const page of pages) {
      for (const ref of page.questionRefs) {
        const raw = rawQuestions.get(ref);
        if (raw) questions.set(ref, this.readQuestion(raw, page.id, position++));
      }
    }
    if (questions.size === 0) {
      throw inputError("qsf.SurveyElements", "The survey has no questions in its survey flow");
    }

    // A second pass: a rule can read a question that appears later in the file.
    for (const question of questions.values()) {
      const raw = rawQuestions.get(question.ref);
      if (raw) question.logic = this.readQuestionLogic(raw.payload);
    }
    for (const [rule, branchLogic] of this.pendingBranchLogic) {
      rule.conditions = this.readBooleanExpression(branchLogic);
    }

    const embeddedDataNames = this.collectEmbeddedDataNames(flowResult.embeddedDataNames);
    const { endMessageKey, endRedirectUrl } = this.readSurveyOptions(options);

    return {
      name: bounded(envelope.data.SurveyEntry.SurveyName, QSF_MAX_NAME_CHARS),
      defaultLanguage: this.defaultLanguage,
      languages: [...this.translationLanguages].sort((left, right) => left.localeCompare(right)),
      questions,
      pages,
      texts: this.texts,
      embeddedDataNames,
      endMessageKey,
      endRedirectUrl,
      issues: this.issues,
    };
  }

  private readDefaultLanguage(raw: unknown): string {
    const code = str(raw) ?? "EN";
    const normalized = normalizeQualtricsLanguageCode(code);
    if (normalized) return normalized;

    this.issues.push({
      code: "language_skipped",
      severity: "warning",
      params: {
        ...(isReportableLanguageCode(code) ? { code: code.trim() } : {}),
        fallback: DEFAULT_V3_SURVEY_LANGUAGE,
      },
    });
    return DEFAULT_V3_SURVEY_LANGUAGE;
  }

  /** The normalized code of a translation's language, or `null` (reported once) when there is none. */
  private translationLanguage(raw: string): string | null {
    if (this.languageByRaw.has(raw)) return this.languageByRaw.get(raw) ?? null;

    const normalized = normalizeQualtricsLanguageCode(raw);
    this.languageByRaw.set(raw, normalized);
    if (!normalized) {
      const reportable = isReportableLanguageCode(raw);
      const reportKey = reportable ? raw.trim() : "";
      if (!this.reportedLanguages.has(reportKey)) {
        this.reportedLanguages.add(reportKey);
        this.issues.push({
          code: "language_skipped",
          severity: "warning",
          ...(reportable ? { params: { code: reportKey } } : {}),
        });
      }
    }
    return normalized;
  }

  private readElements(elements: unknown[]): TReadElements {
    const questions = new Map<string, TRawQuestion>();
    let blocks: Map<string, TRawBlock> | null = null;
    let flow: TReadElements["flow"] = null;
    let options: TRecord | null = null;

    elements.forEach((element, index) => {
      if (!isRecord(element)) return;
      const kind = own(element, "Element");
      const payload = own(element, "Payload");

      if (kind === "SQ") this.readQuestionElement(element, index, questions);
      else if (kind === "BL")
        blocks = readOnce(blocks, index, "block lists", () => this.readBlocks(index, payload));
      else if (kind === "FL")
        flow = readOnce(flow, index, "survey flows", () => ({ index, nodes: flowNodes(payload) }));
      else if (kind === "SO")
        options = readOnce(options, index, "sets of survey options", () => surveyOptions(payload));
      // QC, STAT, RS, SCO, PROJ, Notes and anything newer carry nothing the import uses.
    });

    return { questions, blocks: blocks ?? new Map(), flow, options };
  }

  /** One `SQ` element: kept under its question id when the id is one, reported otherwise. */
  private readQuestionElement(element: TRecord, index: number, questions: Map<string, TRawQuestion>): void {
    const payload = own(element, "Payload");
    if (!isRecord(payload)) return;
    const ref = str(own(element, "PrimaryAttribute"));
    if (ref === null || !QUESTION_REF_PATTERN.test(ref)) {
      this.issues.push({
        code: "question_skipped",
        severity: "warning",
        ...this.questionTag(payload),
        params: { cause: "invalid_id" },
      });
      return;
    }
    if (questions.has(ref)) {
      throw inputError(`qsf.SurveyElements.${index}`, "Two questions in the file share one question id");
    }
    questions.set(ref, {
      ref,
      elementIndex: index,
      payload,
      secondaryAttribute: str(own(element, "SecondaryAttribute")),
    });
  }

  /** `BL` is an array in newer exports and an object keyed by index in older ones. */
  private readBlocks(index: number, payload: unknown): Map<string, TRawBlock> {
    const entries = blockEntries(payload);
    if (entries.length > QSF_MAX_BLOCKS) {
      throw inputError(
        `qsf.SurveyElements.${index}.Payload`,
        `The survey has more than ${QSF_MAX_BLOCKS} blocks`
      );
    }
    const blocks = new Map<string, TRawBlock>();

    for (const entry of entries) {
      if (!isRecord(entry)) continue;
      const id = str(own(entry, "ID"));
      if (id === null || id.length > 64 || blocks.has(id)) continue;

      blocks.set(id, {
        id,
        name: bounded(str(own(entry, "Description")) ?? "", QSF_MAX_NAME_CHARS),
        isTrash: own(entry, "Type") === "Trash",
        elements: this.readBlockElements(index, own(entry, "BlockElements")),
      });
    }

    return blocks;
  }

  /** A block's question refs in order, `null` for a page break; counted against the limit first. */
  private readBlockElements(index: number, rawElements: unknown): (string | null)[] {
    if (!Array.isArray(rawElements)) return [];
    this.blockElementCount += rawElements.length;
    if (this.blockElementCount > QSF_MAX_BLOCK_ELEMENTS) {
      throw inputError(
        `qsf.SurveyElements.${index}.Payload`,
        `The survey's blocks hold more than ${QSF_MAX_BLOCK_ELEMENTS} questions and page breaks`
      );
    }

    const elements: (string | null)[] = [];
    for (const item of rawElements) {
      if (!isRecord(item)) continue;
      const type = own(item, "Type");
      if (type === "Page Break") {
        elements.push(null);
        continue;
      }
      const ref = type === "Question" ? str(own(item, "QuestionID")) : null;
      if (ref !== null && QUESTION_REF_PATTERN.test(ref)) elements.push(ref);
    }
    return elements;
  }

  /**
   * Walk the survey flow in order, iteratively. A branch or randomizer becomes a rule on the first
   * page it gates — the user rebuilds it there — and one that gates no block (a branch straight to the
   * end) goes on the page before it.
   */
  private walkFlow(flow: { index: number; nodes: unknown[] } | null): TFlowResult {
    const result: TFlowResult = { visits: [], embeddedDataNames: [], trailingGates: [] };
    if (!flow) return result;

    const stack: TFlowFrame[] = [{ nodes: flow.nodes, next: 0, depth: 1, gate: null }];
    const visited = new Set<string>();
    let nodeCount = 0;

    for (let frame = stack.at(-1); frame; frame = stack.at(-1)) {
      if (frame.next >= frame.nodes.length) {
        stack.pop();
        closeFlowFrame(frame, result);
        continue;
      }

      nodeCount += 1;
      if (nodeCount > QSF_MAX_FLOW_NODES) {
        throw inputError(
          `qsf.SurveyElements.${flow.index}.Payload.Flow`,
          `The survey flow has more than ${QSF_MAX_FLOW_NODES} elements`
        );
      }
      this.readFlowNode(frame.nodes[frame.next++], { frame, stack, visited, result, flowIndex: flow.index });
    }

    return result;
  }

  /** One flow element: a block shown, embedded data set, or a level of the flow opened. */
  private readFlowNode(
    node: unknown,
    walk: {
      /** The level the element is in. */
      frame: TFlowFrame;
      stack: TFlowFrame[];
      visited: Set<string>;
      result: TFlowResult;
      flowIndex: number;
    }
  ): void {
    if (!isRecord(node)) return;
    const type = own(node, "Type");
    if (type === "Block" || type === "Standard") {
      visitBlock(str(own(node, "ID")), walk.stack, walk.visited, walk.result);
    } else if (type === "EmbeddedData") {
      this.readEmbeddedDataNode(node, walk.result);
    } else {
      const nested = this.openNestedFlow(node, type, walk.frame, walk.flowIndex);
      if (nested) walk.stack.push(nested);
    }
  }

  /** The names an `EmbeddedData` flow element sets, counted against the limit before they are read. */
  private readEmbeddedDataNode(node: TRecord, result: TFlowResult): void {
    const fields = own(node, "EmbeddedData");
    if (!Array.isArray(fields)) return;
    this.countEmbeddedDataFields(fields.length);
    for (const field of fields) {
      if (!isRecord(field)) continue;
      const name = str(own(field, "Field")) ?? str(own(field, "Description"));
      if (name !== null && trimmedHead(name, 2 * QSF_MAX_NAME_CHARS).length > 0) {
        result.embeddedDataNames.push(name);
      }
    }
  }

  /**
   * The frame for a flow element's children — a branch, randomizer or group — or `null` when it has
   * none. A branch or randomizer carries a gate for the first page under it.
   */
  private openNestedFlow(
    node: TRecord,
    type: unknown,
    parent: TFlowFrame,
    flowIndex: number
  ): TFlowFrame | null {
    const children = own(node, "Flow");
    if (!Array.isArray(children)) return null;
    if (parent.depth + 1 > QSF_MAX_FLOW_DEPTH) {
      throw inputError(
        `qsf.SurveyElements.${flowIndex}.Payload.Flow`,
        `The survey flow is nested deeper than ${QSF_MAX_FLOW_DEPTH} levels`
      );
    }

    let gate: TFlowFrame["gate"] = null;
    if (type === "Branch") {
      const rule: TQsfLogicRule = { kind: "branch", conditions: [] };
      this.pendingBranchLogic.set(rule, own(node, "BranchLogic"));
      gate = { rule, attached: false };
    } else if (type === "BlockRandomizer" || type === "Randomizer") {
      gate = { rule: { kind: "randomizer", conditions: [] }, attached: false };
    }
    return { nodes: children, next: 0, depth: parent.depth + 1, gate };
  }

  private buildPages(
    flow: TFlowResult,
    blocks: Map<string, TRawBlock>,
    rawQuestions: Map<string, TRawQuestion>
  ): TQsfPage[] {
    const pages: TQsfPage[] = [];
    const placed = new Set<string>();
    const lastPageOfVisit: (TQsfPage | null)[] = [];

    for (const visit of flow.visits) {
      const block = blocks.get(visit.blockId);
      if (block && !block.isTrash) this.addBlockPages(block, visit, rawQuestions, placed, pages);
      lastPageOfVisit.push(pages.at(-1) ?? null);

      if (placed.size > QSF_MAX_QUESTIONS) {
        throw inputError(
          "qsf.SurveyElements",
          `The survey has more than ${QSF_MAX_QUESTIONS} questions; split it in Qualtrics and import each part`
        );
      }
    }

    for (const { afterVisit, rule } of flow.trailingGates) {
      const page = (afterVisit >= 0 ? lastPageOfVisit[afterVisit] : null) ?? pages[0];
      if (page) page.logic = [...page.logic, rule];
    }

    this.reportUnplacedQuestions(blocks, rawQuestions, placed);
    return pages;
  }

  /** A block's pages, one per page break, holding the questions no earlier page placed. */
  private addBlockPages(
    block: TRawBlock,
    visit: TFlowVisit,
    rawQuestions: Map<string, TRawQuestion>,
    placed: Set<string>,
    pages: TQsfPage[]
  ): void {
    const blockNameKey = this.addText("b", "plain", null, block.name);
    let current: string[] = [];
    let firstPageOfBlock = true;
    const flush = () => {
      if (current.length === 0) return;
      pages.push({
        id: `p${pages.length + 1}`,
        blockId: block.id,
        blockNameKey,
        questionRefs: current,
        logic: firstPageOfBlock ? visit.gates : [],
      });
      firstPageOfBlock = false;
      current = [];
    };

    for (const ref of block.elements) {
      if (ref === null) {
        flush();
      } else if (rawQuestions.has(ref) && !placed.has(ref)) {
        placed.add(ref);
        current.push(ref);
      }
    }
    flush();
  }

  /** Questions the flow never shows. Trashed ones are deleted in Qualtrics and not worth a line. */
  private reportUnplacedQuestions(
    blocks: Map<string, TRawBlock>,
    rawQuestions: Map<string, TRawQuestion>,
    placed: Set<string>
  ): void {
    const trashed = new Set<string>();
    for (const block of blocks.values()) {
      if (!block.isTrash) continue;
      for (const ref of block.elements) if (ref !== null) trashed.add(ref);
    }
    for (const raw of rawQuestions.values()) {
      if (placed.has(raw.ref) || trashed.has(raw.ref)) continue;
      this.issues.push({
        code: "question_skipped",
        severity: "info",
        ...this.questionTag(raw.payload, raw.ref),
        questionRef: raw.ref,
        params: { cause: "not_in_flow" },
      });
    }
  }

  private readQuestion(raw: TRawQuestion, pageId: string, position: number): TQsfQuestion {
    const { payload, ref } = raw;
    const textKey = this.addText(
      "t",
      "rich",
      ref,
      str(own(payload, "QuestionText")) ?? raw.secondaryAttribute ?? ""
    );

    const choiceKeys = new Map<string, TQsfTextKey>();
    const choices = this.readOptions(
      ref,
      raw.elementIndex,
      payload,
      "Choices",
      "ChoiceOrder",
      "c",
      choiceKeys
    );
    const answerKeys = new Map<string, TQsfTextKey>();
    const answers = this.readOptions(
      ref,
      raw.elementIndex,
      payload,
      "Answers",
      "AnswerOrder",
      "a",
      answerKeys
    );
    this.choiceKeysByRef.set(ref, choiceKeys);
    this.readTranslations(raw.elementIndex, payload, textKey, choiceKeys, answerKeys);

    const validation = ownRecord(payload, "Validation");
    const settings = (validation && ownRecord(validation, "Settings")) ?? {};
    const force = str(own(settings, "ForceResponse"))?.toUpperCase() ?? null;
    const randomization = ownRecord(payload, "Randomization");
    const randomizationType = randomization ? token(own(randomization, "Type")) : null;

    return {
      ref,
      exportTag: exportTagOf(payload) ?? ref,
      position,
      pageId,
      qualtricsType: token(own(payload, "QuestionType")) ?? "Unknown",
      selector: token(own(payload, "Selector")),
      subSelector: token(own(payload, "SubSelector")),
      textKey,
      choices,
      answers,
      forceResponse: force === "ON" || force === "OFF" || force === "REQUEST" ? force : null,
      contentType: token(own(settings, "ContentType")),
      dateFormat: token(own(settings, "ValidDateType")),
      slider: this.readSlider(payload),
      randomized: randomizationType !== null && randomizationType !== "None",
      logic: [],
    };
  }

  /** `Choices` is keyed by id; `ChoiceOrder` gives the display order, with ids as strings or numbers. */
  private readOptions(
    ref: string,
    elementIndex: number,
    payload: TRecord,
    mapKey: "Choices" | "Answers",
    orderKey: "ChoiceOrder" | "AnswerOrder",
    keyPrefix: "c" | "a",
    keysById: Map<string, TQsfTextKey>
  ): TQsfOption[] {
    const records = ownRecord(payload, mapKey);
    if (!records) return [];

    const ids = optionIds(records, own(payload, orderKey), () =>
      inputError(
        `qsf.SurveyElements.${elementIndex}.Payload.${mapKey}`,
        `A question has more than ${QSF_MAX_OPTIONS_PER_QUESTION} ${mapKey === "Choices" ? "choices" : "answers"}`
      )
    );
    const options: TQsfOption[] = [];
    for (const id of ids) {
      if (!OPTION_ID_PATTERN.test(id) || isObjectMemberName(id)) {
        this.issues.push({
          code: "choice_dropped",
          severity: "warning",
          ...this.questionTag(payload, ref),
          questionRef: ref,
          params: { cause: "invalid_id" },
        });
        continue;
      }
      const record = records[id];
      const option = isRecord(record) ? record : {};
      const key = this.addText(keyPrefix, "plain", ref, str(own(option, "Display")) ?? "");
      keysById.set(id, key);
      options.push({
        key,
        textEntry: isTrue(own(option, "TextEntry")),
        exclusive: isTrue(own(option, "ExclusiveAnswer")),
      });
    }
    return options;
  }

  private readTranslations(
    elementIndex: number,
    payload: TRecord,
    textKey: TQsfTextKey,
    choiceKeys: Map<string, TQsfTextKey>,
    answerKeys: Map<string, TQsfTextKey>
  ): void {
    const languages = ownRecord(payload, "Language");
    if (!languages) return;
    const rawCodes = this.languageKeys(elementIndex, languages);

    // A language another key of this question already filled costs nothing: the first key wins.
    const applied = new Set<string>();
    for (const rawCode of rawCodes) {
      const language = this.translationLanguage(rawCode);
      if (!language || language === this.defaultLanguage || applied.has(language)) continue;
      const translation = ownRecord(languages, rawCode);
      if (!translation) continue;
      applied.add(language);
      this.addTranslationLanguage(language);

      const questionText = str(own(translation, "QuestionText"));
      if (questionText !== null) this.setTranslation(textKey, language, questionText);
      const choices = ownRecord(translation, "Choices");
      if (choices) this.readOptionTranslations(choices, choiceKeys, language);
      const answers = ownRecord(translation, "Answers");
      if (answers) this.readOptionTranslations(answers, answerKeys, language);
    }
  }

  /**
   * A question's raw `Language` keys, counted against the limits before any is read: variants of one
   * code (`DE`, ` de`) normalize to one language, so only a count bounds what they cost.
   */
  private languageKeys(elementIndex: number, languages: TRecord): string[] {
    const rawCodes = Object.keys(languages);
    if (rawCodes.length > QSF_MAX_LANGUAGE_KEYS_PER_QUESTION) {
      throw inputError(
        `qsf.SurveyElements.${elementIndex}.Payload.Language`,
        `A question has more than ${QSF_MAX_LANGUAGE_KEYS_PER_QUESTION} translations`
      );
    }
    this.languageKeyCount += rawCodes.length;
    if (this.languageKeyCount > QSF_MAX_LANGUAGE_KEYS) {
      throw inputError(
        "qsf.SurveyElements",
        `The survey has more than ${QSF_MAX_LANGUAGE_KEYS} translations`
      );
    }
    return rawCodes;
  }

  /** A survey language, refused the moment it would be one more than a Formbricks survey can have. */
  private addTranslationLanguage(language: string): void {
    if (this.translationLanguages.has(language)) return;
    // The default, the translations so far, and this one.
    if (1 + this.translationLanguages.size + 1 > QSF_MAX_LANGUAGES) {
      throw inputError(
        "qsf.SurveyElements",
        `The survey has more than ${QSF_MAX_LANGUAGES} languages, the most a Formbricks survey can have`
      );
    }
    this.translationLanguages.add(language);
  }

  /**
   * One translation's labels for a question's options, matched by Qualtrics id. Walks whichever side is
   * smaller — the translation's entries or the question's options — so its cost is bounded by both.
   */
  private readOptionTranslations(records: TRecord, keys: Map<string, TQsfTextKey>, language: string): void {
    const recordIds = Object.keys(records);
    const ids = recordIds.length < keys.size ? recordIds : [...keys.keys()];
    for (const id of ids) {
      const key = keys.get(id);
      if (!key) continue;
      const record = own(records, id);
      const display = isRecord(record) ? str(own(record, "Display")) : str(record);
      if (display !== null) this.setTranslation(key, language, display);
    }
  }

  /** Embedded data fields the flow sets, refused past `QSF_MAX_EMBEDDED_DATA_FIELDS` before any is read. */
  private countEmbeddedDataFields(count: number): void {
    this.embeddedDataFieldCount += count;
    if (this.embeddedDataFieldCount > QSF_MAX_EMBEDDED_DATA_FIELDS) {
      throw inputError(
        "qsf.SurveyElements",
        `The survey has more than ${QSF_MAX_EMBEDDED_DATA_FIELDS} embedded data fields`
      );
    }
  }

  private readSlider(payload: TRecord): TQsfSlider | null {
    const configuration = ownRecord(payload, "Configuration");
    if (!configuration) return null;
    const slider: TQsfSlider = {
      min: num(own(configuration, "CSSliderMin")),
      max: num(own(configuration, "CSSliderMax")),
      gridLines: num(own(configuration, "GridLines")),
      stars: num(own(configuration, "NumStars")),
    };
    return Object.values(slider).every((value) => value === null) ? null : slider;
  }

  private readQuestionLogic(payload: TRecord): TQsfLogicRule[] {
    const rules: TQsfLogicRule[] = [];

    const display = own(payload, "DisplayLogic");
    if (isRecord(display)) {
      rules.push({ kind: "display", conditions: this.readBooleanExpression(display) });
    }

    const skip = own(payload, "SkipLogic");
    const skipRules = Array.isArray(skip) ? skip : [];
    for (const entry of skipRules.slice(0, QSF_MAX_LOGIC_TERMS)) {
      if (!isRecord(entry)) continue;
      const locator = this.readLocator(str(own(entry, "ChoiceLocator")) ?? str(own(entry, "Locator")));
      const destination = str(own(entry, "SkipToDestination"));
      rules.push({
        kind: "skip",
        conditions: [{ ...locator, operator: token(own(entry, "Condition")) ?? "unknown" }],
        destination: this.readSkipDestination(destination),
      });
    }

    return rules;
  }

  private readSkipDestination(destination: string | null): string {
    if (destination === "ENDOFSURVEY") return "end_of_survey";
    if (destination === "ENDOFBLOCK") return "end_of_block";
    if (destination !== null && QUESTION_REF_PATTERN.test(destination)) return destination;
    return "unknown";
  }

  /**
   * A `BooleanExpression`: groups under `"0"`, `"1"`, …, each holding expressions under `"0"`, `"1"`, ….
   * Read at that fixed depth and capped, never walked.
   */
  private readBooleanExpression(value: unknown): TQsfLogicCondition[] {
    if (!isRecord(value)) return [];
    const conditions: TQsfLogicCondition[] = [];

    for (let group = 0; group < QSF_MAX_LOGIC_TERMS; group++) {
      const groupRecord = ownRecord(value, String(group));
      if (!groupRecord) break;
      for (let index = 0; index < QSF_MAX_LOGIC_TERMS; index++) {
        const expression = ownRecord(groupRecord, String(index));
        if (!expression) break;
        conditions.push(this.readExpression(expression, index > 0 || group > 0));
      }
    }

    return conditions;
  }

  private readExpression(expression: TRecord, joined: boolean): TQsfLogicCondition {
    const logicType = token(own(expression, "LogicType"));
    const operator = token(own(expression, "Operator")) ?? "unknown";
    const conjunction = readConjunction(expression, joined);
    const value = readCompared(expression);

    if (logicType === "EmbeddedField") {
      const field = str(own(expression, "LeftOperand"));
      return {
        ...(field === null ? {} : { field: bounded(field, MAX_LOGIC_VALUE_CHARS) }),
        operator,
        ...value,
        ...conjunction,
      };
    }

    if (logicType === "Question") {
      const locator = this.readLocator(
        str(own(expression, "LeftOperand")) ?? str(own(expression, "ChoiceLocator"))
      );
      return { ...locator, operator, ...value, ...conjunction };
    }

    return { operator: logicType ?? operator, ...conjunction };
  }

  /** `q://QID3/SelectableChoice/2` → the question and the text key of its choice. */
  private readLocator(locator: string | null): Pick<TQsfLogicCondition, "questionRef" | "choiceKey"> {
    if (!locator?.startsWith("q://")) return {};
    const [questionRef, , choiceId] = locator.slice(4, 200).split("/");
    if (!questionRef || !QUESTION_REF_PATTERN.test(questionRef)) return {};
    const choiceKey = choiceId ? this.choiceKeysByRef.get(questionRef)?.get(choiceId) : undefined;
    return { questionRef, ...(choiceKey ? { choiceKey } : {}) };
  }

  private collectEmbeddedDataNames(fromFlow: string[]): string[] {
    const names: string[] = [];
    const seen = new Set<string>();
    const add = (name: string) => {
      const value = bounded(trimmedHead(name, 2 * QSF_MAX_NAME_CHARS), QSF_MAX_NAME_CHARS);
      if (value.length === 0 || seen.has(value)) return;
      seen.add(value);
      names.push(value);
    };
    // The flow's were counted as they were read; a name a text pipes in counts once.
    const addPiped = (name: string) => {
      const before = seen.size;
      add(name);
      if (seen.size > before) this.countEmbeddedDataFields(1);
    };

    fromFlow.forEach(add);
    for (const text of this.texts.values()) {
      for (const raw of text.byLanguage.values()) {
        // A text the sanitizer refuses for its length is left out of the survey, and never scanned.
        if (raw.length <= QSF_MAX_TEXT_CHARS) collectEmbeddedDataReferences(raw).forEach(addPiped);
      }
    }

    // Past what a survey can hold, the first ones are kept — the flow's, then the ones texts pipe in —
    // and the rest dropped with one line. Piped text that names a dropped field is then removed.
    if (names.length > QSF_MAX_HIDDEN_FIELDS) {
      this.issues.push({
        code: "field_dropped",
        severity: "warning",
        params: { count: names.length - QSF_MAX_HIDDEN_FIELDS },
      });
      return names.slice(0, QSF_MAX_HIDDEN_FIELDS);
    }
    return names;
  }

  private readSurveyOptions(options: TRecord | null): {
    endMessageKey: TQsfTextKey | null;
    endRedirectUrl: string | null;
  } {
    if (!options) return { endMessageKey: null, endRedirectUrl: null };

    // `MS_…` is a message library reference, whose text is not in the export. A message past the
    // text limit is kept as it is, for the sanitizer to refuse and report.
    const rawMessage = str(own(options, "EOSMessage")) ?? "";
    const message = rawMessage.length > QSF_MAX_TEXT_CHARS ? rawMessage : rawMessage.trim();
    const isMessageRef = message.length <= MAX_MESSAGE_REF_CHARS && MESSAGE_REF_PATTERN.test(message);
    const endMessageKey =
      message.length > 0 && !isMessageRef ? this.addText("s", "rich", null, message) : null;

    const rawUrl = str(own(options, "EOSRedirectURL")) ?? "";
    const url = rawUrl.length > 2 * MAX_URL_CHARS ? "" : rawUrl.trim();
    return {
      endMessageKey,
      endRedirectUrl: url.length > 0 && url.length <= MAX_URL_CHARS ? url : null,
    };
  }

  /** A text's translation into one language, counted when the text did not have that language yet. */
  private setTranslation(key: TQsfTextKey, language: string, text: string): void {
    const byLanguage = this.texts.get(key)?.byLanguage;
    if (!byLanguage) return;
    if (!byLanguage.has(language)) this.countText(text);
    byLanguage.set(language, text);
  }

  /**
   * One more text to sanitize, refused before it is kept past `QSF_MAX_TEXTS`, or past
   * `QSF_MAX_MARKUP_TEXTS` when it is one the sanitizer has to parse.
   */
  private countText(text: string): void {
    this.textCount += 1;
    if (this.textCount > QSF_MAX_TEXTS) {
      throw inputError(
        "qsf.SurveyElements",
        `The survey has more than ${QSF_MAX_TEXTS} texts across its languages`
      );
    }
    if (!needsParsing(text)) return;
    this.markupTextCount += 1;
    if (this.markupTextCount > QSF_MAX_MARKUP_TEXTS) {
      throw inputError(
        "qsf.SurveyElements",
        `The survey has more than ${QSF_MAX_MARKUP_TEXTS} formatted texts across its languages`
      );
    }
  }

  private addText(
    prefix: keyof QsfReader["counters"],
    format: TQsfTextFormat,
    questionRef: string | null,
    defaultText: string
  ): TQsfTextKey {
    this.countText(defaultText);
    this.counters[prefix] += 1;
    const key = `${prefix}${this.counters[prefix]}`;
    this.texts.set(key, {
      format,
      questionRef,
      byLanguage: new Map([[this.defaultLanguage, defaultText]]),
    });
    return key;
  }

  private questionTag(payload: TRecord, fallback?: string): { questionTag?: string } {
    const tag = exportTagOf(payload) ?? fallback;
    return tag ? { questionTag: bounded(tag, QSF_MAX_NAME_CHARS) } : {};
  }
}

/**
 * Read a parsed Qualtrics export. Throws `QsfImportInputError` for a file it cannot read or one past a
 * reader limit; everything else that is wrong with the file becomes a report line.
 */
export function readQsf(qsf: Record<string, unknown>): TQsfSurvey {
  return new QsfReader().read(qsf);
}
