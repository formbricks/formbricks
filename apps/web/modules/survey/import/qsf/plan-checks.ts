import {
  QSF_PLAN_ELEMENT_TYPES,
  type TQsfPlanContactField,
  type TQsfPlanElementType,
  type TQsfPlanQuestion,
  ZQsfImportPlanEnvelope,
  ZQsfPlanPage,
  ZQsfPlanQuestion,
  ZQsfPlanSkip,
} from "./plan-schema";
import type { TQsfQuestion, TQsfSurvey, TQsfTextKey } from "./qsf-model";

/**
 * The code checks on an AI plan (ENG-3479). The plan is untrusted output — the file it was made from
 * can say anything to the model — so nothing in it is used until it passes here:
 *
 * - each question exactly once: one entry, or skipped; refs outside the call are ignored;
 * - each text key owned by that question and used once;
 * - the type on the allowlist, and the roles fitting the type (counts included);
 * - free text (notes, skip reasons) cleaned and capped, for the report only.
 *
 * A question that fails gets the reasons back for one retry (`ai-plan.ts`).
 */

const ALLOWED_TYPES: ReadonlySet<string> = new Set(QSF_PLAN_ELEMENT_TYPES);
const ALLOWED_RANGES: Record<string, readonly number[]> = {
  rating: [3, 4, 5, 6, 7, 10],
  csat: [5],
  ces: [5, 7],
};

/** Longest note or skip reason the report carries. */
export const QSF_MAX_NOTE_CHARS = 300;

export type TQsfPlanFailure =
  /** Never asked: the import's AI budget (calls, prompt size or time) ran out first. */
  | "ai_budget"
  | "invalid_output"
  | "invalid_entry"
  | "missing"
  | "duplicate_ref"
  | "placed_and_skipped"
  | "type_not_allowed"
  | "foreign_key"
  | "key_reused"
  | "role_not_for_type"
  | "missing_role"
  | "too_few_options"
  | "too_many_options"
  | "invalid_range"
  | "missing_scale"
  | "missing_format";

export interface TQsfPlannedOption {
  key: TQsfTextKey;
  special?: "other" | "none";
}

export interface TQsfPlannedQuestion {
  ref: string;
  type: TQsfPlanElementType;
  required: boolean;
  choices: TQsfPlannedOption[];
  rows: TQsfTextKey[];
  columns: TQsfTextKey[];
  labelKey: TQsfTextKey | null;
  contactFields: { field: TQsfPlanContactField; key: TQsfTextKey }[];
  inputType: NonNullable<TQsfPlanQuestion["inputType"]>;
  scale: TQsfPlanQuestion["scale"];
  range: number | null;
  format: TQsfPlanQuestion["format"];
  notes: string[];
}

export interface TQsfCheckedPlan {
  questions: Map<string, TQsfPlannedQuestion>;
  /** Notes on each page's branch and randomizer rules, by page id. */
  pageNotes: Map<string, string[]>;
  /** Skipped by the AI, with its cleaned reason (or `null`). */
  skipped: Map<string, string | null>;
  failures: Map<string, TQsfPlanFailure[]>;
}

/** One answered AI call: the refs it was asked about and what came back. */
export interface TQsfPlanResponse {
  refs: ReadonlySet<string>;
  object: unknown;
}

// Control characters and the bidi overrides, which can make a report line read as something else.
// eslint-disable-next-line no-control-regex -- matching control characters is the point
const CONTROL_CHARACTERS = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g;
/**
 * Top-level domains common enough that a bare `name.tld` in a note is taken for a link. Two-letter ones
 * that are English words (`it`, `in`, `at`, `me`, `us`, `is`, `to`, `no`, `be`, `do`, `so`, …) are
 * left out: "selected.It then skips" is a missing space, not a link. Those still count with a path,
 * port, `@` or `www.` (`evil.it/x`).
 */
const COMMON_TLDS = [
  "com",
  "net",
  "org",
  "io",
  "co",
  "info",
  "biz",
  "app",
  "dev",
  "xyz",
  "ai",
  "ly",
  "gg",
  "tk",
  "top",
  "site",
  "online",
  "shop",
  "link",
  "click",
  "live",
  "store",
  "eu",
  "uk",
  "de",
  "fr",
  "nl",
  "ch",
  "es",
  "ru",
  "cn",
  "jp",
  "br",
  "au",
  "ca",
].join("|");
const DOTTED_NAME = String.raw`(?:[a-z0-9-]{1,63}\.)+[a-z]{2,24}`;

/**
 * Anything that looks like a link. A dotted word counts as a domain only with a sign it is one — a
 * path, a port, an `@` before it, or a common top-level domain — so `Node.js` or `answer.Then` stay
 * prose while `evil.com/login`, `evil.io:8080` and `user@evil.co` do not. Labels are bounded and
 * separated by dots, so a long run backtracks a bounded amount per position.
 */
const URL_LIKE = new RegExp(
  [
    String.raw`\b(?:[a-z][a-z0-9+.-]{1,20}:\/\/|(?:javascript|data|vbscript|mailto):|www\.)\S*`,
    String.raw`[\w.+-]{0,64}@${DOTTED_NAME}\b\S*`,
    String.raw`\b${DOTTED_NAME}(?::\d{1,5})?\/\S*`,
    String.raw`\b${DOTTED_NAME}:\d{1,5}\b`,
    String.raw`\b(?:[a-z0-9-]{1,63}\.)+(?:${COMMON_TLDS})\b`,
  ].join("|"),
  "gi"
);

/**
 * Free text from the AI, made safe for a report line: control characters gone, anything that looks
 * like a link replaced by `…`, markup characters dropped, whitespace collapsed, capped. The dialog
 * renders it as plain text as well; this is so a line never carries a link at all.
 */
export function cleanNote(raw: string): string {
  const cleaned = raw
    .slice(0, QSF_MAX_NOTE_CHARS * 4)
    .replaceAll(CONTROL_CHARACTERS, " ")
    .replaceAll(URL_LIKE, "…")
    .replaceAll(/[<>]/g, "")
    .replaceAll(/\s+/g, " ")
    .trim();
  return cleaned.length > QSF_MAX_NOTE_CHARS ? `${cleaned.slice(0, QSF_MAX_NOTE_CHARS - 1)}…` : cleaned;
}

const cleanNotes = (notes: string[]): string[] => notes.map(cleanNote).filter((note) => note.length > 0);

const sourceKeys = (question: TQsfQuestion, source: "choices" | "answers" | null): TQsfTextKey[] =>
  source === null ? [] : question[source].map((option) => option.key);

type TRoleResult = { ok: true; question: TQsfPlannedQuestion } | { ok: false; reasons: TQsfPlanFailure[] };

/** Whether the roles in one entry fit its type and the question it is about. */
export function checkQuestionRoles(question: TQsfQuestion, entry: TQsfPlanQuestion): TRoleResult {
  const reasons = new Set<TQsfPlanFailure>();
  const fail = (reason: TQsfPlanFailure) => reasons.add(reason);

  if (!ALLOWED_TYPES.has(entry.type)) {
    return { ok: false, reasons: ["type_not_allowed"] };
  }
  const type = entry.type as TQsfPlanElementType;

  // Every key a role names must be one of this question's own, and each is used once.
  const ownKeys = new Set([...sourceKeys(question, "choices"), ...sourceKeys(question, "answers")]);
  const used = new Set<string>();
  const roleKeys = [
    entry.otherChoiceKey,
    entry.noneChoiceKey,
    entry.labelKey,
    ...entry.excludedKeys,
    ...entry.contactFields.map((field) => field.key),
  ].filter((key): key is string => key !== null);
  for (const key of roleKeys) {
    if (!ownKeys.has(key)) fail("foreign_key");
    else if (used.has(key)) fail("key_reused");
    used.add(key);
  }
  if (reasons.size > 0) return { ok: false, reasons: [...reasons] };

  const excluded = new Set(entry.excludedKeys);
  const listed = (source: "choices" | "answers" | null) =>
    sourceKeys(question, source).filter((key) => !excluded.has(key));

  const usesChoices = type === "multipleChoiceSingle" || type === "multipleChoiceMulti" || type === "ranking";
  const usesMatrix = type === "matrix";
  const usesRating = type === "rating" || type === "csat" || type === "ces";

  // Roles a type does not use must be empty: a stray one says the model misread the question.
  if (!usesChoices && entry.choicesFrom !== null) fail("role_not_for_type");
  if (!usesMatrix && (entry.rowsFrom !== null || entry.columnsFrom !== null)) fail("role_not_for_type");
  if (type !== "multipleChoiceSingle" && type !== "multipleChoiceMulti" && entry.otherChoiceKey !== null) {
    fail("role_not_for_type");
  }
  if (type !== "multipleChoiceMulti" && entry.noneChoiceKey !== null) fail("role_not_for_type");
  if (type !== "consent" && entry.labelKey !== null) fail("role_not_for_type");
  if (type !== "contactInfo" && entry.contactFields.length > 0) fail("role_not_for_type");

  let choices: TQsfPlannedOption[] = [];
  let rows: TQsfTextKey[] = [];
  let columns: TQsfTextKey[] = [];

  if (usesChoices) {
    if (entry.choicesFrom === null) {
      fail("missing_role");
    } else {
      const special = new Map<string, "other" | "none">();
      if (entry.otherChoiceKey) special.set(entry.otherChoiceKey, "other");
      if (entry.noneChoiceKey) special.set(entry.noneChoiceKey, "none");
      const keys = listed(entry.choicesFrom);
      for (const key of special.keys()) if (!keys.includes(key)) fail("foreign_key");
      choices = keys.map((key) => {
        const role = special.get(key);
        return role ? { key, special: role } : { key };
      });
      if (choices.length < 2) fail("too_few_options");
      if (type === "ranking" && choices.length > 25) fail("too_many_options");
    }
  }

  if (usesMatrix) {
    if (entry.rowsFrom === null || entry.columnsFrom === null || entry.rowsFrom === entry.columnsFrom) {
      fail("missing_role");
    } else {
      rows = listed(entry.rowsFrom);
      columns = listed(entry.columnsFrom);
      if (rows.length < 1 || columns.length < 2) fail("too_few_options");
    }
  }

  let range: number | null = null;
  if (usesRating) {
    if (entry.scale === null) fail("missing_scale");
    range = entry.range === null ? null : Number(entry.range);
    if (range === null || !ALLOWED_RANGES[type].includes(range)) fail("invalid_range");
  }

  if (type === "date" && entry.format === null) fail("missing_format");

  const choiceKeys = new Set(sourceKeys(question, "choices"));
  if (type === "consent" && (entry.labelKey === null || !choiceKeys.has(entry.labelKey))) {
    fail("missing_role");
  }
  if (type === "contactInfo") {
    const fields = entry.contactFields.map((field) => field.field);
    if (fields.length === 0 || new Set(fields).size !== fields.length) fail("missing_role");
    if (entry.contactFields.some((field) => !choiceKeys.has(field.key))) fail("foreign_key");
  }

  if (reasons.size > 0) return { ok: false, reasons: [...reasons] };

  return {
    ok: true,
    question: {
      ref: question.ref,
      type,
      required: entry.required,
      choices,
      rows,
      columns,
      labelKey: entry.labelKey,
      contactFields: entry.contactFields,
      inputType: entry.inputType ?? "text",
      scale: entry.scale,
      range,
      format: entry.format,
      notes: cleanNotes(entry.logicNotes),
    },
  };
}

const readRef = (entry: unknown): string | null =>
  typeof entry === "object" && entry !== null && "ref" in entry && typeof entry.ref === "string"
    ? entry.ref
    : null;

/**
 * Check the answers of one round of AI calls. Each response is checked within the refs its call was
 * asked about; a ref outside them is ignored, so one call can never place, skip or claim the keys of a
 * question another call owns.
 */
export function checkPlanResponses(survey: TQsfSurvey, responses: TQsfPlanResponse[]): TQsfCheckedPlan {
  const plan: TQsfCheckedPlan = {
    questions: new Map(),
    pageNotes: new Map(),
    skipped: new Map(),
    failures: new Map(),
  };
  const addFailure = (ref: string, reason: TQsfPlanFailure) => {
    const reasons = plan.failures.get(ref) ?? [];
    if (!reasons.includes(reason)) reasons.push(reason);
    plan.failures.set(ref, reasons);
  };

  for (const response of responses) {
    const envelope = ZQsfImportPlanEnvelope.safeParse(response.object);
    if (!envelope.success) {
      for (const ref of response.refs) addFailure(ref, "invalid_output");
      continue;
    }

    const entries = new Map<string, TQsfPlanQuestion[]>();
    for (const raw of envelope.data.questions) {
      const ref = readRef(raw);
      if (ref === null || !response.refs.has(ref)) continue;
      const parsed = ZQsfPlanQuestion.safeParse(raw);
      if (!parsed.success) {
        addFailure(ref, "invalid_entry");
        continue;
      }
      entries.set(ref, [...(entries.get(ref) ?? []), parsed.data]);
    }

    const skips = new Map<string, string[]>();
    for (const raw of envelope.data.skipped) {
      const parsed = ZQsfPlanSkip.safeParse(raw);
      if (!parsed.success || !response.refs.has(parsed.data.ref)) continue;
      skips.set(parsed.data.ref, [...(skips.get(parsed.data.ref) ?? []), parsed.data.reason]);
    }

    // Notes for the pages this call holds questions of. A page split across calls keeps the first.
    const pageIds = new Set([...response.refs].map((ref) => survey.questions.get(ref)?.pageId));
    for (const raw of envelope.data.pages ?? []) {
      const parsed = ZQsfPlanPage.safeParse(raw);
      if (!parsed.success || !pageIds.has(parsed.data.id) || plan.pageNotes.has(parsed.data.id)) continue;
      plan.pageNotes.set(parsed.data.id, cleanNotes(parsed.data.logicNotes));
    }

    for (const ref of response.refs) {
      if (plan.failures.has(ref)) continue;
      const question = survey.questions.get(ref);
      const entryList = entries.get(ref) ?? [];
      const skipList = skips.get(ref) ?? [];

      if (!question) continue;
      if (entryList.length > 1 || skipList.length > 1) {
        addFailure(ref, "duplicate_ref");
      } else if (skipList.length === 1 && entryList.length > 0) {
        addFailure(ref, "placed_and_skipped");
      } else if (skipList.length === 1) {
        const reason = cleanNote(skipList[0]);
        plan.skipped.set(ref, reason.length > 0 ? reason : null);
      } else if (entryList.length === 0) {
        addFailure(ref, "missing");
      } else {
        const result = checkQuestionRoles(question, entryList[0]);
        if (result.ok) plan.questions.set(ref, result.question);
        else for (const reason of result.reasons) addFailure(ref, reason);
      }
    }
  }

  return plan;
}

/**
 * Merge a retry round into the first one. The retry's verdicts replace the first round's failures;
 * page notes the first round already had stay.
 */
export function mergeCheckedPlans(first: TQsfCheckedPlan, retry: TQsfCheckedPlan): TQsfCheckedPlan {
  return {
    questions: new Map([...first.questions, ...retry.questions]),
    skipped: new Map([...first.skipped, ...retry.skipped]),
    pageNotes: new Map([...retry.pageNotes, ...first.pageNotes]),
    failures: new Map(retry.failures),
  };
}
