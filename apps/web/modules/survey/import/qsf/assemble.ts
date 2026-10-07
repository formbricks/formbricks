import { createId } from "@paralleldrive/cuid2";
import { ZEndingCardUrl } from "@formbricks/types/common";
import { toSafeIdentifier } from "@formbricks/types/safe-identifier";
import type { TSurveyLanguage } from "@formbricks/types/surveys/types";
import {
  findLanguageCodesForDuplicateLabels,
  getTextContent,
  validateId,
} from "@formbricks/types/surveys/validation";
import type { TQsfImportIssue } from "../types";
import { QsfIdRegistry, isObjectMemberName } from "./id-registry";
import { type TPipedTextContext, replacePipedText } from "./piped-text";
import type { TQsfCheckedPlan, TQsfPlannedQuestion } from "./plan-checks";
import type { TQsfPlanContactField } from "./plan-schema";
import type { TQsfQuestion, TQsfSurvey, TQsfTextKey } from "./qsf-model";
import { type TSanitizedTexts, sanitizeName } from "./sanitize-text";

/**
 * The assembly (ENG-3654): the checked plan and the sanitized texts become the draft the dialog sends
 * to `POST /api/v3/surveys` — the locale-keyed request shape, not the internal `default` key.
 *
 * Every text is copied by key from the file; the plan only says where. Ids are the import's own:
 * element ids from export tags through `QsfIdRegistry`, every choice, row, column, block and ending id
 * from `createId()`. Nothing from the plan or the file becomes a URL except the end-of-survey redirect,
 * and only when the organization's plan allows external URLs.
 */

/** Text keyed by language code, default language first. */
export type TQsfLocaleText = Record<string, string>;

interface TDraftElementBase {
  id: string;
  headline: TQsfLocaleText;
  required: boolean;
  isDraft: true;
}

interface TDraftChoice {
  id: string;
  label: TQsfLocaleText;
}

interface TDraftToggleInput {
  show: boolean;
  required: boolean;
  placeholder: TQsfLocaleText;
}

export type TQsfDraftElement = TDraftElementBase &
  (
    | {
        type: "openText";
        inputType: TQsfPlannedQuestion["inputType"];
        longAnswer: boolean;
        charLimit: { enabled: false };
      }
    | {
        type: "multipleChoiceSingle" | "multipleChoiceMulti";
        choices: TDraftChoice[];
        shuffleOption: "none" | "all" | "exceptLast";
        displayType: "list" | "dropdown";
      }
    | { type: "ranking"; choices: TDraftChoice[]; shuffleOption: "none" | "all" }
    | { type: "matrix"; rows: TDraftChoice[]; columns: TDraftChoice[]; shuffleOption: "none" }
    | { type: "nps"; isColorCodingEnabled: false }
    | {
        type: "rating" | "csat" | "ces";
        scale: NonNullable<TQsfPlannedQuestion["scale"]>;
        range: number;
        isColorCodingEnabled: false;
      }
    | { type: "date"; format: NonNullable<TQsfPlannedQuestion["format"]> }
    | { type: "fileUpload"; allowMultipleFiles: false }
    | ({ type: "contactInfo" } & Record<TQsfPlanContactField, TDraftToggleInput>)
    | { type: "consent"; label: TQsfLocaleText }
    | { type: "cta"; buttonExternal: false }
  );

export type TQsfDraftEnding =
  | { id: string; type: "endScreen"; headline: TQsfLocaleText }
  | { id: string; type: "redirectToUrl"; url: string; label: string };

/** The create document, typed: `TV3CreateSurveyRequestBody` is the schema's input, which is `unknown`. */
export interface TQsfDraftDocument {
  workspaceId: string;
  name: string;
  type: "link";
  status: "draft";
  defaultLanguage: string;
  languages: { code: string; default: boolean; enabled: boolean }[];
  blocks: { id: string; name: string; elements: TQsfDraftElement[] }[];
  endings: TQsfDraftEnding[];
  hiddenFields: { enabled: boolean; fieldIds: string[] };
}

export interface TQsfAssembly {
  document: TQsfDraftDocument;
  issues: TQsfImportIssue[];
  /** The question ref behind each element, by block and element index, to map a gate issue back. */
  elementRefs: string[][];
}

export interface TAssembleQsfDraftParams {
  survey: TQsfSurvey;
  texts: TSanitizedTexts;
  plan: TQsfCheckedPlan;
  workspaceId: string;
  allowExternalUrls: boolean;
  /** Questions the final gate refused on a first pass. */
  excludedRefs?: ReadonlySet<string>;
}

const CONTACT_FIELDS: readonly TQsfPlanContactField[] = [
  "firstName",
  "lastName",
  "email",
  "phone",
  "company",
];
const LONG_ANSWER_SELECTORS = new Set(["ML", "ESTB"]);
const MAX_HIDDEN_FIELD_ID_LENGTH = 64;

/**
 * Embedded data names → hidden field ids. A name Formbricks refuses for a new field — reserved, not a
 * safe identifier, or an `Object.prototype` member, which `isSafeIdentifier` admits — is renamed and
 * reported.
 */
function buildHiddenFields(names: string[]): {
  fieldIds: string[];
  idByName: Map<string, string>;
  issues: TQsfImportIssue[];
} {
  const fieldIds: string[] = [];
  const idByName = new Map<string, string>();
  const issues: TQsfImportIssue[] = [];
  const isFree = (id: string) =>
    id.length > 0 &&
    id.length <= MAX_HIDDEN_FIELD_ID_LENGTH &&
    !isObjectMemberName(id) &&
    validateId(id, [], [], fieldIds, [], { requireSafeIdentifier: true }) === null;

  for (const name of names) {
    let id = name;
    if (!isFree(id)) {
      const base =
        toSafeIdentifier(name).slice(0, MAX_HIDDEN_FIELD_ID_LENGTH - 8) || `field_${fieldIds.length + 1}`;
      id = isFree(base) ? base : `${base}_field`;
      for (let counter = 2; !isFree(id); counter += 1) id = `${base}_field_${counter}`;
      issues.push({ code: "field_renamed", severity: "warning", params: { from: name, to: id } });
    }
    fieldIds.push(id);
    idByName.set(name, id);
  }

  return { fieldIds, idByName, issues };
}

/** Disambiguate labels that repeat within a language: `N/A`, `N/A (2)`. Returns whether any changed. */
export function disambiguateLabels(
  items: TDraftChoice[],
  languageCodes: string[],
  surveyLanguages: TSurveyLanguage[]
): boolean {
  // The survey service's own duplicate check, on the internal shape it reads.
  const [defaultCode] = languageCodes;
  const internal = items.map((item) =>
    Object.fromEntries(
      languageCodes.map((code) => [code === defaultCode ? "default" : code, item.label[code] ?? ""])
    )
  );
  const duplicated = findLanguageCodesForDuplicateLabels(internal, surveyLanguages);
  if (duplicated.length === 0) return false;

  for (const flagged of duplicated) {
    const code = flagged === "default" ? defaultCode : flagged;
    // Every label the language already has, so a number added never lands on one of them: `N/A`,
    // `N/A`, `N/A (2)` becomes `N/A`, `N/A (3)`, `N/A (2)`.
    const taken = new Set(items.map((item) => (item.label[code] ?? "").trim()));
    const seen = new Set<string>();
    for (const item of items) {
      const text = (item.label[code] ?? "").trim();
      if (!seen.has(text)) {
        seen.add(text);
        continue;
      }
      let counter = 2;
      while (taken.has(`${text} (${counter})`)) counter += 1;
      const renamed = `${text} (${counter})`;
      item.label[code] = renamed;
      taken.add(renamed);
      seen.add(renamed);
    }
  }
  return true;
}

class QsfAssembler {
  private readonly issues: TQsfImportIssue[] = [];
  private readonly languageCodes: string[];
  private readonly surveyLanguages: TSurveyLanguage[];
  private readonly fallbackCounts = new Map<string, number>();
  private readonly elementIdByRef = new Map<string, string>();
  private readonly blockIndexByRef = new Map<string, number>();
  private hiddenFieldIdByName = new Map<string, string>();

  constructor(private readonly params: TAssembleQsfDraftParams) {
    const { survey } = params;
    this.languageCodes = [survey.defaultLanguage, ...survey.languages];
    // Only what `findLanguageCodesForDuplicateLabels` reads: the code, and whether it is the default.
    this.surveyLanguages = this.languageCodes.map((code, index) => ({
      language: {
        id: code,
        code,
        alias: null,
        workspaceId: params.workspaceId,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
      default: index === 0,
      enabled: true,
    }));
  }

  assemble(): TQsfAssembly {
    const { survey, plan, excludedRefs } = this.params;

    const hidden = buildHiddenFields(survey.embeddedDataNames);
    this.hiddenFieldIdByName = hidden.idByName;
    this.issues.push(...hidden.issues);

    // One block per Qualtrics page (ENG-3410), in flow order, holding the page's planned questions in
    // the page's own order. Built here rather than taken from the AI, so a page split across AI calls,
    // or a question that only a retry placed, still lands in its page's single block.
    const placedBlocks = survey.pages
      .map((page) => ({
        page,
        refs: page.questionRefs.filter((ref) => plan.questions.has(ref) && !excludedRefs?.has(ref)),
      }))
      .filter((block) => block.refs.length > 0);

    // First pass: every element's id and block — recall needs both up front.
    const registry = new QsfIdRegistry(hidden.fieldIds);
    placedBlocks.forEach((block, blockIndex) => {
      for (const ref of block.refs) {
        const question = survey.questions.get(ref);
        if (!question) continue;
        this.elementIdByRef.set(ref, registry.claim(question.exportTag, ref));
        this.blockIndexByRef.set(ref, blockIndex);
      }
    });

    const blocks: TQsfDraftDocument["blocks"] = [];
    const elementRefs: string[][] = [];
    placedBlocks.forEach(({ page, refs: pageRefs }, blockIndex) => {
      const elements: TQsfDraftElement[] = [];
      const refs: string[] = [];
      for (const ref of pageRefs) {
        const question = survey.questions.get(ref);
        const planned = plan.questions.get(ref);
        if (!question || !planned) continue;
        elements.push(this.buildElement(question, planned, blockIndex));
        refs.push(ref);
        this.reportQuestionLogic(question, planned);
      }
      const name = this.params.texts.byKey.get(page.blockNameKey)?.get(survey.defaultLanguage) ?? "";
      blocks.push({ id: createId(), name: name || `Block ${blockIndex + 1}`, elements });
      elementRefs.push(refs);
      // The page's branch and randomizer rules, on the page's first imported question.
      this.reportRules(
        page.logic.length,
        plan.pageNotes.get(page.id) ?? [],
        survey.questions.get(refs[0])?.exportTag
      );
    });

    // A page none of whose questions was imported still had its branch or randomizer: the user
    // rebuilds it around whatever replaces the page. No question to name, so its block's name instead.
    const placedPages = new Set(placedBlocks.map(({ page }) => page.id));
    for (const page of survey.pages) {
      if (placedPages.has(page.id) || page.logic.length === 0) continue;
      const blockName = this.params.texts.byKey.get(page.blockNameKey)?.get(survey.defaultLanguage) ?? "";
      this.reportRules(page.logic.length, plan.pageNotes.get(page.id) ?? [], undefined, blockName);
    }

    for (const [language, count] of this.fallbackCounts) {
      this.issues.push({ code: "translation_fallback", severity: "warning", params: { language, count } });
    }

    return {
      document: {
        workspaceId: this.params.workspaceId,
        name: `${sanitizeName(survey.name) || "Qualtrics survey"} (imported)`,
        type: "link",
        status: "draft",
        defaultLanguage: survey.defaultLanguage,
        languages: this.languageCodes.map((code, index) => ({ code, default: index === 0, enabled: true })),
        blocks,
        endings: this.buildEndings(),
        hiddenFields: { enabled: hidden.fieldIds.length > 0, fieldIds: hidden.fieldIds },
      },
      issues: this.issues,
      elementRefs,
    };
  }

  /**
   * A text in every declared language. A missing or empty translation falls back to the default
   * language's text and is counted: v3 requires every declared language, and the survey service
   * refuses an empty label.
   */
  private localize(
    key: TQsfTextKey,
    context: TPipedTextContext | null,
    piped: { removed: number }
  ): TQsfLocaleText {
    const byLanguage = this.params.texts.byKey.get(key);
    const [defaultCode] = this.languageCodes;
    const convert = (text: string) => {
      const result = replacePipedText(text, context);
      piped.removed += result.removed;
      return result.text;
    };

    const defaultText = convert(byLanguage?.get(defaultCode) ?? "");
    const localized: TQsfLocaleText = { [defaultCode]: defaultText };
    for (const code of this.languageCodes.slice(1)) {
      const translated = byLanguage?.get(code);
      const converted = translated === undefined ? "" : convert(translated);
      if (getTextContent(converted).length > 0) {
        localized[code] = converted;
      } else {
        localized[code] = defaultText;
        if (getTextContent(defaultText).length > 0) {
          this.fallbackCounts.set(code, (this.fallbackCounts.get(code) ?? 0) + 1);
        }
      }
    }
    return localized;
  }

  /** The same fixed text in every language, for a label the file left empty. */
  private uniform(text: string): TQsfLocaleText {
    return Object.fromEntries(this.languageCodes.map((code) => [code, text]));
  }

  /** Replace whatever is empty after sanitizing with `fallback`, in that language only. */
  private filled(text: TQsfLocaleText, fallback: string): { text: TQsfLocaleText; filled: boolean } {
    let filled = false;
    const result: TQsfLocaleText = {};
    for (const code of this.languageCodes) {
      const value = text[code] ?? "";
      if (getTextContent(value).length > 0) {
        result[code] = value;
      } else {
        result[code] = fallback;
        filled = true;
      }
    }
    return { text: result, filled };
  }

  private recallContext(blockIndex: number): TPipedTextContext {
    return {
      // Only an element of an earlier block: its answer exists by the time this text shows.
      recallElement: (ref) =>
        (this.blockIndexByRef.get(ref) ?? Number.POSITIVE_INFINITY) < blockIndex
          ? (this.elementIdByRef.get(ref) ?? null)
          : null,
      hiddenField: (name) => this.hiddenFieldIdByName.get(name) ?? null,
    };
  }

  private buildOptions(keys: TQsfTextKey[], piped: { removed: number }): TDraftChoice[] {
    return keys.map((key, index) => ({
      id: createId(),
      label: this.filled(this.localize(key, null, piped), String(index + 1)).text,
    }));
  }

  private buildElement(
    question: TQsfQuestion,
    planned: TQsfPlannedQuestion,
    blockIndex: number
  ): TQsfDraftElement {
    const piped = { removed: 0 };
    const tag = question.exportTag;
    const headline = this.filled(
      this.localize(question.textKey, this.recallContext(blockIndex), piped),
      sanitizeName(tag) || question.ref
    );
    if (headline.filled) {
      this.issues.push({ code: "headline_fallback", severity: "warning", questionTag: tag });
    }

    const base: TDraftElementBase = {
      id: this.elementIdByRef.get(question.ref) ?? question.ref,
      headline: headline.text,
      required: planned.required,
      isDraft: true,
    };
    let renamedLabels = false;
    const options = (keys: TQsfTextKey[]) => {
      const items = this.buildOptions(keys, piped);
      if (disambiguateLabels(items, this.languageCodes, this.surveyLanguages)) renamedLabels = true;
      return items;
    };

    const element = this.buildTyped(question, planned, base, options, piped);

    if (piped.removed > 0) {
      this.issues.push({
        code: "piped_text_removed",
        severity: "warning",
        questionTag: tag,
        params: { count: piped.removed },
      });
    }
    if (renamedLabels) {
      this.issues.push({ code: "choice_label_renamed", severity: "info", questionTag: tag });
    }
    return element;
  }

  private buildTyped(
    question: TQsfQuestion,
    planned: TQsfPlannedQuestion,
    base: TDraftElementBase,
    options: (keys: TQsfTextKey[]) => TDraftChoice[],
    piped: { removed: number }
  ): TQsfDraftElement {
    switch (planned.type) {
      case "openText":
        return {
          ...base,
          type: "openText",
          inputType: planned.inputType,
          longAnswer: question.selector !== null && LONG_ANSWER_SELECTORS.has(question.selector),
          charLimit: { enabled: false },
        };
      case "multipleChoiceSingle":
      case "multipleChoiceMulti": {
        const regular = planned.choices.filter((choice) => !choice.special);
        const special = (role: "other" | "none") =>
          planned.choices.filter((choice) => choice.special === role);
        // Formbricks keeps the special choices last, other before none, under fixed ids.
        const ordered = [...regular, ...special("other"), ...special("none")];
        const choices = options(ordered.map((choice) => choice.key)).map((choice, index) => {
          const role = ordered[index].special;
          return role ? { ...choice, id: role } : choice;
        });
        const hasSpecial = ordered.length !== regular.length;
        return {
          ...base,
          type: planned.type,
          choices,
          shuffleOption: question.randomized ? (hasSpecial ? "exceptLast" : "all") : "none",
          displayType: question.selector === "DL" ? "dropdown" : "list",
        };
      }
      case "ranking":
        return {
          ...base,
          type: "ranking",
          choices: options(planned.choices.map((choice) => choice.key)),
          shuffleOption: question.randomized ? "all" : "none",
        };
      case "matrix":
        return {
          ...base,
          type: "matrix",
          rows: options(planned.rows),
          columns: options(planned.columns),
          shuffleOption: "none",
        };
      case "nps":
        return { ...base, type: "nps", isColorCodingEnabled: false };
      case "rating":
      case "csat":
      case "ces":
        return {
          ...base,
          type: planned.type,
          scale: planned.scale ?? "number",
          range: planned.range ?? 5,
          isColorCodingEnabled: false,
        };
      case "date":
        return { ...base, type: "date", format: planned.format ?? "M-d-y" };
      case "fileUpload":
        return { ...base, type: "fileUpload", allowMultipleFiles: false };
      case "contactInfo": {
        const keyByField = new Map(planned.contactFields.map((field) => [field.field, field.key]));
        const fields = Object.fromEntries(
          CONTACT_FIELDS.map((field, index) => {
            const key = keyByField.get(field);
            return [
              field,
              key
                ? {
                    show: true,
                    required: planned.required,
                    placeholder: this.filled(this.localize(key, null, piped), String(index + 1)).text,
                  }
                : { show: false, required: false, placeholder: this.uniform("") },
            ];
          })
        ) as Record<TQsfPlanContactField, TDraftToggleInput>;
        return { ...base, type: "contactInfo", ...fields };
      }
      case "consent":
        return {
          ...base,
          type: "consent",
          label: this.filled(
            this.localize(planned.labelKey ?? "", null, piped),
            getTextContent(base.headline[this.languageCodes[0]] ?? "") || "1"
          ).text,
        };
      case "cta":
        return { ...base, type: "cta", required: false, buttonExternal: false };
    }
  }

  /**
   * One `logic_not_imported` line per rule the question had. The AI's notes describe them; a rule it
   * wrote no note for still gets a line, and notes beyond the rule count are dropped, so the AI can
   * neither hide a rule nor add lines of its own.
   */
  private reportQuestionLogic(question: TQsfQuestion, planned: TQsfPlannedQuestion): void {
    this.reportRules(question.logic.length, planned.notes, question.exportTag);
  }

  private reportRules(
    ruleCount: number,
    notes: string[],
    questionTag: string | undefined,
    blockName?: string
  ): void {
    for (let index = 0; index < ruleCount; index++) {
      const params = {
        ...(notes[index] ? { description: notes[index] } : {}),
        ...(blockName ? { block: blockName } : {}),
      };
      this.issues.push({
        code: "logic_not_imported",
        severity: "warning",
        ...(questionTag ? { questionTag } : {}),
        ...(Object.keys(params).length > 0 ? { params } : {}),
      });
    }
  }

  /**
   * The end of the survey. A redirect replaces the message, as in Qualtrics, but only when the
   * organization's plan allows external URLs — the create checks that too — and the URL is one an
   * ending may hold.
   */
  private buildEndings(): TQsfDraftEnding[] {
    const { survey, allowExternalUrls } = this.params;
    const url = survey.endRedirectUrl;
    if (url) {
      const host = allowExternalUrls ? redirectHost(url) : null;
      if (host) {
        // The label only names the ending in the editor, and the survey service requires one. The
        // host says where it goes without the import writing text of its own.
        return [{ id: createId(), type: "redirectToUrl", url, label: host }];
      }
      this.issues.push({ code: "external_url_removed", severity: "warning" });
    }

    if (!survey.endMessageKey) return [];
    const headline = this.localize(survey.endMessageKey, this.recallContext(Number.POSITIVE_INFINITY), {
      removed: 0,
    });
    const defaultHeadline = headline[survey.defaultLanguage] ?? "";
    if (getTextContent(defaultHeadline).length === 0) return [];
    return [{ id: createId(), type: "endScreen", headline: this.filled(headline, defaultHeadline).text }];
  }
}

/**
 * The host of a redirect an ending may hold, or `null`. Recall tokens and piped text are refused
 * outright: in the file they are its own text, and in a URL they would become live references.
 */
function redirectHost(url: string): string | null {
  if (url.includes("#recall:") || url.includes("${") || !ZEndingCardUrl.safeParse(url).success) return null;
  try {
    return new URL(url).hostname || null;
  } catch {
    return null;
  }
}

export function assembleQsfDraft(params: TAssembleQsfDraftParams): TQsfAssembly {
  return new QsfAssembler(params).assemble();
}
