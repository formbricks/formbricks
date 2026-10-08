import { z } from "zod";
import { DEFAULT_V3_SURVEY_LANGUAGE } from "@/app/api/v3/surveys/schemas";
import type { TQsfImportIssue } from "../types";
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
  QSF_MAX_NAME_CHARS,
  QSF_MAX_OPTIONS_PER_QUESTION,
  QSF_MAX_QUESTIONS,
} from "./limits";
import { collectEmbeddedDataReferences } from "./piped-text";
import type {
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
 *   entries, embedded data, options, `Language` keys — so a file past one costs a count, not the work.
 */

/** Qualtrics question ids are `QID` and a number. Anything else is refused, `__proto__` included. */
const QUESTION_REF_PATTERN = /^QID[1-9]\d{0,8}$/;
/** Choice ids are numbers in every export seen; letters are tolerated, punctuation is not. */
const OPTION_ID_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const TOKEN_PATTERN = /^[A-Za-z][A-Za-z0-9_-]{0,39}$/;
const MAX_LOGIC_VALUE_CHARS = 80;
const MAX_URL_CHARS = 2_000;

/**
 * The part of the envelope every Qualtrics export has, read before anything else. Strict about the
 * three keys it checks and blind to the rest: it never copies the file.
 */
const ZQsfEnvelope = z.object({
  SurveyEntry: z.object({ SurveyName: z.string().trim().min(1) }),
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
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) {
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
  private readonly issues: TQsfImportIssue[] = [];
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

  private readElements(elements: unknown[]): {
    questions: Map<string, TRawQuestion>;
    blocks: Map<string, TRawBlock>;
    flow: { index: number; nodes: unknown[] } | null;
    options: TRecord | null;
  } {
    const questions = new Map<string, TRawQuestion>();
    let blocks: Map<string, TRawBlock> | null = null;
    let flow: { index: number; nodes: unknown[] } | null = null;
    let options: TRecord | null = null;

    elements.forEach((element, index) => {
      if (!isRecord(element)) return;
      const kind = own(element, "Element");
      const payload = own(element, "Payload");

      if (kind === "SQ") {
        const ref = str(own(element, "PrimaryAttribute"));
        if (!isRecord(payload)) return;
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
        return;
      }

      if (kind === "BL") {
        if (blocks) throw inputError(`qsf.SurveyElements.${index}`, "The file has two block lists");
        blocks = this.readBlocks(index, payload);
        return;
      }

      if (kind === "FL") {
        if (flow) throw inputError(`qsf.SurveyElements.${index}`, "The file has two survey flows");
        const nodes = isRecord(payload) ? own(payload, "Flow") : null;
        flow = { index, nodes: Array.isArray(nodes) ? nodes : [] };
        return;
      }

      if (kind === "SO") {
        if (options)
          throw inputError(`qsf.SurveyElements.${index}`, "The file has two sets of survey options");
        options = isRecord(payload) ? payload : {};
      }
      // QC, STAT, RS, SCO, PROJ, Notes and anything newer carry nothing the import uses.
    });

    return { questions, blocks: blocks ?? new Map(), flow, options };
  }

  /** `BL` is an array in newer exports and an object keyed by index in older ones. */
  private readBlocks(index: number, payload: unknown): Map<string, TRawBlock> {
    const entries = Array.isArray(payload)
      ? payload
      : isRecord(payload)
        ? Object.keys(payload).map((key) => payload[key])
        : [];
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

      const rawElements = own(entry, "BlockElements");
      const elements: (string | null)[] = [];
      if (Array.isArray(rawElements)) {
        this.blockElementCount += rawElements.length;
        if (this.blockElementCount > QSF_MAX_BLOCK_ELEMENTS) {
          throw inputError(
            `qsf.SurveyElements.${index}.Payload`,
            `The survey's blocks hold more than ${QSF_MAX_BLOCK_ELEMENTS} questions and page breaks`
          );
        }
        for (const item of rawElements) {
          if (!isRecord(item)) continue;
          const type = own(item, "Type");
          if (type === "Page Break") {
            elements.push(null);
          } else if (type === "Question") {
            const ref = str(own(item, "QuestionID"));
            if (ref !== null && QUESTION_REF_PATTERN.test(ref)) elements.push(ref);
          }
        }
      }

      blocks.set(id, {
        id,
        name: bounded(str(own(entry, "Description")) ?? "", QSF_MAX_NAME_CHARS),
        isTrash: own(entry, "Type") === "Trash",
        elements,
      });
    }

    return blocks;
  }

  /**
   * Walk the survey flow in order, iteratively. A branch or randomizer becomes a rule on the first
   * page it gates — the user rebuilds it there — and one that gates no block (a branch straight to the
   * end) goes on the page before it.
   */
  private walkFlow(flow: { index: number; nodes: unknown[] } | null): TFlowResult {
    const result: TFlowResult = { visits: [], embeddedDataNames: [], trailingGates: [] };
    if (!flow) return result;

    interface TFrame {
      nodes: unknown[];
      next: number;
      depth: number;
      gate: { rule: TQsfLogicRule; attached: boolean } | null;
    }
    const stack: TFrame[] = [{ nodes: flow.nodes, next: 0, depth: 1, gate: null }];
    const visited = new Set<string>();
    let nodeCount = 0;

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      if (frame.next >= frame.nodes.length) {
        stack.pop();
        if (frame.gate && !frame.gate.attached) {
          result.trailingGates.push({ afterVisit: result.visits.length - 1, rule: frame.gate.rule });
        }
        continue;
      }

      const node = frame.nodes[frame.next++];
      nodeCount += 1;
      if (nodeCount > QSF_MAX_FLOW_NODES) {
        throw inputError(
          `qsf.SurveyElements.${flow.index}.Payload.Flow`,
          `The survey flow has more than ${QSF_MAX_FLOW_NODES} elements`
        );
      }
      if (!isRecord(node)) continue;

      const type = own(node, "Type");
      if (type === "Block" || type === "Standard") {
        const blockId = str(own(node, "ID"));
        if (blockId === null || visited.has(blockId)) continue;
        visited.add(blockId);

        const gates: TQsfLogicRule[] = [];
        for (const open of stack) {
          if (open.gate && !open.gate.attached) {
            open.gate.attached = true;
            gates.push(open.gate.rule);
          }
        }
        result.visits.push({ blockId, gates });
        continue;
      }

      if (type === "EmbeddedData") {
        const fields = own(node, "EmbeddedData");
        if (Array.isArray(fields)) {
          this.countEmbeddedDataFields(fields.length);
          for (const field of fields) {
            if (!isRecord(field)) continue;
            const name = str(own(field, "Field")) ?? str(own(field, "Description"));
            if (name !== null && name.trim().length > 0) result.embeddedDataNames.push(name);
          }
        }
        continue;
      }

      const children = own(node, "Flow");
      if (!Array.isArray(children)) continue;
      if (frame.depth + 1 > QSF_MAX_FLOW_DEPTH) {
        throw inputError(
          `qsf.SurveyElements.${flow.index}.Payload.Flow`,
          `The survey flow is nested deeper than ${QSF_MAX_FLOW_DEPTH} levels`
        );
      }

      let gate: TFrame["gate"] = null;
      if (type === "Branch") {
        const rule: TQsfLogicRule = { kind: "branch", conditions: [] };
        this.pendingBranchLogic.set(rule, own(node, "BranchLogic"));
        gate = { rule, attached: false };
      } else if (type === "BlockRandomizer" || type === "Randomizer") {
        gate = { rule: { kind: "randomizer", conditions: [] }, attached: false };
      }
      stack.push({ nodes: children, next: 0, depth: frame.depth + 1, gate });
    }

    return result;
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
      if (!block || block.isTrash) {
        lastPageOfVisit.push(pages.at(-1) ?? null);
        continue;
      }

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

    // Questions the flow never shows. Trashed ones are deleted in Qualtrics and not worth a line.
    const trashed = new Set<string>();
    for (const block of blocks.values()) {
      if (block.isTrash) for (const ref of block.elements) if (ref !== null) trashed.add(ref);
    }
    for (const raw of rawQuestions.values()) {
      if (placed.has(raw.ref) || trashed.has(raw.ref)) continue;
      this.issues.push({
        code: "question_skipped",
        severity: "info",
        ...this.questionTag(raw.payload, raw.ref),
        params: { cause: "not_in_flow" },
      });
    }

    return pages;
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
      exportTag: bounded(str(own(payload, "DataExportTag"))?.trim() || ref, QSF_MAX_NAME_CHARS),
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

    const order = own(payload, orderKey);
    const ids: string[] = [];
    const seen = new Set<string>();
    // Refused at the first option past the limit, before any is read.
    const consider = (id: string) => {
      if (seen.has(id) || !Object.hasOwn(records, id)) return;
      seen.add(id);
      ids.push(id);
      if (ids.length > QSF_MAX_OPTIONS_PER_QUESTION) {
        throw inputError(
          `qsf.SurveyElements.${elementIndex}.Payload.${mapKey}`,
          `A question has more than ${QSF_MAX_OPTIONS_PER_QUESTION} ${mapKey === "Choices" ? "choices" : "answers"}`
        );
      }
    };
    if (Array.isArray(order)) for (const id of order) if (str(id) !== null) consider(String(id));
    for (const id of Object.keys(records)) consider(id);

    const options: TQsfOption[] = [];
    for (const id of ids) {
      if (!OPTION_ID_PATTERN.test(id) || isObjectMemberName(id)) {
        this.issues.push({
          code: "choice_dropped",
          severity: "warning",
          ...this.questionTag(payload, ref),
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

    // Counted before any key is read: variants of one code (`DE`, ` de`) normalize to one language,
    // so only a count bounds what they cost.
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
      if (questionText !== null) this.texts.get(textKey)?.byLanguage.set(language, questionText);

      for (const [mapKey, keys] of [
        ["Choices", choiceKeys],
        ["Answers", answerKeys],
      ] as const) {
        const records = ownRecord(translation, mapKey);
        if (records) this.readOptionTranslations(records, keys, language);
      }
    }
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
      if (display !== null) this.texts.get(key)?.byLanguage.set(language, display);
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
    const conjunctionRaw = token(own(expression, "Conjuction"))?.toLowerCase();
    const conjunction =
      joined && (conjunctionRaw === "and" || conjunctionRaw === "or") ? conjunctionRaw : undefined;
    const right = str(own(expression, "RightOperand"));
    const value = right === null ? undefined : bounded(right, MAX_LOGIC_VALUE_CHARS);

    if (logicType === "EmbeddedField") {
      const field = str(own(expression, "LeftOperand"));
      return {
        ...(field === null ? {} : { field: bounded(field, MAX_LOGIC_VALUE_CHARS) }),
        operator,
        ...(value === undefined ? {} : { value }),
        ...(conjunction ? { conjunction } : {}),
      };
    }

    if (logicType === "Question") {
      const locator = this.readLocator(
        str(own(expression, "LeftOperand")) ?? str(own(expression, "ChoiceLocator"))
      );
      return {
        ...locator,
        operator,
        ...(value === undefined ? {} : { value }),
        ...(conjunction ? { conjunction } : {}),
      };
    }

    return { operator: logicType ?? operator, ...(conjunction ? { conjunction } : {}) };
  }

  /** `q://QID3/SelectableChoice/2` → the question and the text key of its choice. */
  private readLocator(locator: string | null): Pick<TQsfLogicCondition, "questionRef" | "choiceKey"> {
    if (locator === null || !locator.startsWith("q://")) return {};
    const [questionRef, , choiceId] = locator.slice(4, 200).split("/");
    if (!questionRef || !QUESTION_REF_PATTERN.test(questionRef)) return {};
    const choiceKey = choiceId ? this.choiceKeysByRef.get(questionRef)?.get(choiceId) : undefined;
    return { questionRef, ...(choiceKey ? { choiceKey } : {}) };
  }

  private collectEmbeddedDataNames(fromFlow: string[]): string[] {
    const names: string[] = [];
    const seen = new Set<string>();
    const add = (name: string) => {
      const value = bounded(name.trim(), QSF_MAX_NAME_CHARS);
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
      for (const raw of text.byLanguage.values()) collectEmbeddedDataReferences(raw).forEach(addPiped);
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

    // `MS_…` is a message library reference, whose text is not in the export.
    const message = str(own(options, "EOSMessage"))?.trim() ?? "";
    const endMessageKey =
      message.length > 0 && !/^MS_[A-Za-z0-9]+$/.test(message)
        ? this.addText("s", "rich", null, message)
        : null;

    const url = str(own(options, "EOSRedirectURL"))?.trim() ?? "";
    return {
      endMessageKey,
      endRedirectUrl: url.length > 0 && url.length <= MAX_URL_CHARS ? url : null,
    };
  }

  private addText(
    prefix: keyof QsfReader["counters"],
    format: TQsfTextFormat,
    questionRef: string | null,
    defaultText: string
  ): TQsfTextKey {
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
    const tag = str(own(payload, "DataExportTag"))?.trim() || fallback;
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
