import { createId } from "@paralleldrive/cuid2";
import { ZEndingCardUrl } from "@formbricks/types/common";
import { toSafeIdentifier } from "@formbricks/types/safe-identifier";
import type { TSurveyLanguage } from "@formbricks/types/surveys/types";
import {
  findLanguageCodesForDuplicateLabels,
  getTextContent,
  validateId,
} from "@formbricks/types/surveys/validation";
import { getDefaultEndingTexts } from "./default-ending";
import type {
  TDraftChoice,
  TDraftElementBase,
  TDraftToggleInput,
  TQsfDraftDocument,
  TQsfDraftElement,
  TQsfDraftEnding,
  TQsfLocaleText,
} from "./draft";
import { createSlicer } from "./event-loop";
import { QsfIdRegistry, findFreeSuffixedName, isObjectMemberName } from "./id-registry";
import { type TPipedTextContext, replacePipedText } from "./piped-text";
import type { TQsfCheckedPlan, TQsfPlannedQuestion } from "./plan-checks";
import type { TQsfPlanContactField } from "./plan-schema";
import type { TQsfIssue, TQsfQuestion, TQsfSurvey, TQsfTextKey } from "./qsf-model";
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

/**
 * Whether a text shows anything, as the create's check reads it (`getTextContent`). That parses the
 * text as HTML twice; a text with no `<` cannot hold an element, so for it the answer is its trimmed
 * self, and most texts — every plain option and translation — skip the parse.
 */
const hasTextContent = (text: string): boolean =>
  text.includes("<") ? getTextContent(text).length > 0 : text.trim().length > 0;

export type { TQsfDraftDocument, TQsfDraftElement, TQsfDraftEnding, TQsfLocaleText } from "./draft";

export interface TQsfAssembly {
  document: TQsfDraftDocument;
  issues: TQsfIssue[];
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
  /**
   * Questions cut from the survey before planning, to fit the create's body. Like the ones the gate
   * refused, a pipe to one shows the recall fallback, with a report line.
   */
  cutRefs?: ReadonlySet<string>;
  /** Stops assembly between questions when it fires. */
  signal?: AbortSignal;
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
 * reported: to its safe form, then that with `_field`, then `_field_2`, `_field_3`, …, and last to
 * `field_2`, `field_3`, ….
 *
 * Every search is bounded by the names already taken, so the renaming always ends: the candidates of
 * one search are distinct and well-formed (each fits the length, and a safe stem keeps it safe), so at
 * most one more than the ids taken can be refused. It never spins on a file's names (ENG-3654 review:
 * 11 long names with the same first 56 characters used to).
 */
export function buildHiddenFields(names: string[]): {
  fieldIds: string[];
  idByName: Map<string, string>;
  issues: TQsfIssue[];
} {
  const fieldIds: string[] = [];
  const taken = new Set<string>();
  const idByName = new Map<string, string>();
  const issues: TQsfIssue[] = [];
  // Duplicates are checked against `taken`, in O(1); `validateId` only checks the name itself.
  const isFree = (id: string) =>
    id.length > 0 &&
    id.length <= MAX_HIDDEN_FIELD_ID_LENGTH &&
    !taken.has(id.toLowerCase()) &&
    !isObjectMemberName(id) &&
    validateId(id, [], [], [], [], { requireSafeIdentifier: true }) === null;
  const suffixed = (stem: string, separator: string) =>
    findFreeSuffixedName(stem, {
      separator,
      maxLength: MAX_HIDDEN_FIELD_ID_LENGTH,
      maxAttempts: taken.size + 1,
      isFree,
    });

  const rename = (name: string): string => {
    const base =
      toSafeIdentifier(name).slice(0, MAX_HIDDEN_FIELD_ID_LENGTH - 8) || `field_${fieldIds.length + 1}`;
    const renamed =
      [base, `${base}_field`].find((candidate) => isFree(candidate)) ??
      suffixed(base, "_field_") ??
      suffixed("field", "_");
    if (renamed === null) throw new Error("The QSF import found no free hidden field id");
    return renamed;
  };

  for (const name of names) {
    const id = isFree(name) ? name : rename(name);
    if (id !== name) {
      issues.push({ code: "field_renamed", severity: "warning", params: { from: name, to: id } });
    }
    fieldIds.push(id);
    taken.add(id.toLowerCase());
    idByName.set(name, id);
  }

  return { fieldIds, idByName, issues };
}

/** How a multiple choice question shuffles: never its special choices, which stay last. */
const choiceShuffle = (randomized: boolean, hasSpecial: boolean): "none" | "all" | "exceptLast" => {
  if (!randomized) return "none";
  return hasSpecial ? "exceptLast" : "all";
};

/**
 * The respondent language settings for a draft with `languageCount` enabled languages: the switch and
 * browser-language selection on with more than one, nothing with one.
 */
export const languageSettingsFor = (
  languageCount: number
): Pick<TQsfDraftDocument, "showLanguageSwitch" | "autoSelectLanguage"> =>
  languageCount > 1 ? { showLanguageSwitch: true, autoSelectLanguage: true } : {};

/**
 * The document with the language settings its enabled languages call for, after a fit dropped some: a
 * draft cut down to one enabled language loses them.
 */
export function withLanguageSettings(document: TQsfDraftDocument): void {
  delete document.showLanguageSwitch;
  delete document.autoSelectLanguage;
  Object.assign(
    document,
    languageSettingsFor(document.languages.filter((language) => language.enabled).length)
  );
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
    // Per label, the number to try next, so repeats of one label resume where the last one stopped. A
    // step past a number only skips a label in `taken` (the items' own labels and the renames), so the
    // steps of every search together stay under twice the items: it ends, and in linear time.
    const nextNumber = new Map<string, number>();
    for (const item of items) {
      const text = (item.label[code] ?? "").trim();
      if (!seen.has(text)) {
        seen.add(text);
        continue;
      }
      let counter = nextNumber.get(text) ?? 2;
      while (taken.has(`${text} (${counter})`)) counter += 1;
      nextNumber.set(text, counter + 1);
      const renamed = `${text} (${counter})`;
      item.label[code] = renamed;
      taken.add(renamed);
      seen.add(renamed);
    }
  }
  return true;
}

class QsfAssembler {
  private readonly issues: TQsfIssue[] = [];
  private readonly languageCodes: string[];
  private readonly surveyLanguages: TSurveyLanguage[];
  /** Texts each language is missing. A language missing any is imported turned off. */
  private readonly missingCounts = new Map<string, number>();
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

  async assemble(): Promise<TQsfAssembly> {
    const { survey, plan, excludedRefs } = this.params;
    const slice = createSlicer(this.params.signal);

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
    for (const [blockIndex, { page, refs: pageRefs }] of placedBlocks.entries()) {
      const elements: TQsfDraftElement[] = [];
      const refs: string[] = [];
      for (const ref of pageRefs) {
        const question = survey.questions.get(ref);
        const planned = plan.questions.get(ref);
        if (!question || !planned) continue;
        // A question with many options in many languages is thousands of texts: yield between them.
        await slice(); // NOSONAR(typescript:S9382) -- a deliberate yield every slice
        elements.push(this.buildElement(question, planned, blockIndex));
        refs.push(ref);
        this.reportQuestionLogic(question, planned);
      }
      const name = this.params.texts.byKey.get(page.blockNameKey)?.get(survey.defaultLanguage) ?? "";
      blocks.push({ id: createId(), name: name || `Block ${blockIndex + 1}`, elements });
      elementRefs.push(refs);
      // The page's branch and randomizer rules, on the page's first imported question.
      this.reportRules(page.logic.length, plan.pageNotes.get(page.id) ?? [], survey.questions.get(refs[0]));
    }

    // A page none of whose questions was imported still had its branch or randomizer: the user
    // rebuilds it around whatever replaces the page. No question to name, so its block's name instead.
    const placedPages = new Set(placedBlocks.map(({ page }) => page.id));
    for (const page of survey.pages) {
      if (placedPages.has(page.id) || page.logic.length === 0) continue;
      const blockName = this.params.texts.byKey.get(page.blockNameKey)?.get(survey.defaultLanguage) ?? "";
      this.reportRules(page.logic.length, plan.pageNotes.get(page.id) ?? [], undefined, blockName);
    }

    // Built before the languages are settled: an ending's missing translation turns its language off too.
    const endings = await this.buildEndings();
    for (const [language, count] of this.missingCounts) {
      this.issues.push({ code: "translation_missing", severity: "warning", params: { language, count } });
    }
    const languages = this.languageCodes.map((code, index) => ({
      code,
      default: index === 0,
      enabled: !this.missingCounts.has(code),
    }));

    return {
      document: {
        workspaceId: this.params.workspaceId,
        name: `${sanitizeName(survey.name) || "Qualtrics survey"} (imported)`,
        type: "link",
        status: "draft",
        defaultLanguage: survey.defaultLanguage,
        languages,
        blocks,
        endings,
        hiddenFields: { enabled: hidden.fieldIds.length > 0, fieldIds: hidden.fieldIds },
        ...languageSettingsFor(languages.filter((language) => language.enabled).length),
      },
      issues: this.issues,
      elementRefs,
    };
  }

  /**
   * A text in every declared language. A missing or empty translation stays empty and is counted: v3
   * requires every declared language to be present, and the survey service only refuses an empty text
   * in an enabled language, so a language missing any text is imported turned off for the user to
   * complete in the editor.
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
    const defaultShows = hasTextContent(defaultText);
    const localized: TQsfLocaleText = { [defaultCode]: defaultText };
    for (const code of this.languageCodes.slice(1)) {
      const translated = byLanguage?.get(code);
      const converted = translated === undefined ? "" : convert(translated);
      localized[code] = hasTextContent(converted) ? converted : "";
      if (!hasTextContent(converted) && defaultShows) {
        this.missingCounts.set(code, (this.missingCounts.get(code) ?? 0) + 1);
      }
    }
    return localized;
  }

  /** The same fixed text in every language, for a label the file left empty. */
  private uniform(text: string): TQsfLocaleText {
    return Object.fromEntries(this.languageCodes.map((code) => [code, text]));
  }

  /**
   * Replace whatever is empty after sanitizing with `fallback`, in that language only — but only where
   * the file left the text itself empty. A translation missing beside a default text stays empty: its
   * language is imported turned off (see `localize`).
   */
  private filled(text: TQsfLocaleText, fallback: string): { text: TQsfLocaleText; filled: boolean } {
    let filled = false;
    const result: TQsfLocaleText = {};
    const [defaultCode] = this.languageCodes;
    const defaultShows = hasTextContent(text[defaultCode] ?? "");
    for (const code of this.languageCodes) {
      const value = text[code] ?? "";
      if (hasTextContent(value) || (defaultShows && code !== defaultCode)) {
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
      cutQuestion: (ref) => this.isCut(ref),
    };
  }

  /** For a text that does not render recall (a label): no pipe is recalled, a cut one shows the fallback. */
  private labelContext(): TPipedTextContext {
    return { recallElement: () => null, hiddenField: () => null, cutQuestion: (ref) => this.isCut(ref) };
  }

  /** Whether the import cut the question: to fit the create's body, or because the create refused it. */
  private isCut(ref: string): boolean {
    return this.params.cutRefs?.has(ref) === true || this.params.excludedRefs?.has(ref) === true;
  }

  private buildOptions(keys: TQsfTextKey[], piped: { removed: number }): TDraftChoice[] {
    return keys.map((key, index) => ({
      id: createId(),
      label: this.filled(this.localize(key, this.labelContext(), piped), String(index + 1)).text,
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
      this.issues.push({
        code: "headline_fallback",
        severity: "warning",
        questionTag: tag,
        questionRef: question.ref,
      });
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
        questionRef: question.ref,
        params: { count: piped.removed },
      });
    }
    if (renamedLabels) {
      this.issues.push({
        code: "choice_label_renamed",
        severity: "info",
        questionTag: tag,
        questionRef: question.ref,
      });
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
        return {
          ...base,
          type: planned.type,
          choices,
          shuffleOption: choiceShuffle(question.randomized, ordered.length !== regular.length),
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
                    placeholder: this.filled(
                      this.localize(key, this.labelContext(), piped),
                      String(index + 1)
                    ).text,
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
            this.localize(planned.labelKey ?? "", this.labelContext(), piped),
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
    this.reportRules(question.logic.length, planned.notes, question);
  }

  private reportRules(
    ruleCount: number,
    notes: string[],
    /** The question the lines are filed under: the rule's own, or the first of the page it gates. */
    question: TQsfQuestion | undefined,
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
        ...(question ? { questionTag: question.exportTag, questionRef: question.ref } : {}),
        ...(Object.keys(params).length > 0 ? { params } : {}),
      });
    }
  }

  /**
   * The end of the survey. A redirect replaces the message, as in Qualtrics, but only when the
   * organization's plan allows external URLs — the create checks that too — and the URL is one an
   * ending may hold.
   */
  private async buildEndings(): Promise<TQsfDraftEnding[]> {
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

    if (!survey.endMessageKey) return [await this.defaultEnding()];
    const piped = { removed: 0 };
    const headline = this.localize(survey.endMessageKey, this.recallContext(Number.POSITIVE_INFINITY), piped);
    if (piped.removed > 0) {
      // No question to name: the line says it is about the ending.
      this.issues.push({
        code: "piped_text_removed",
        severity: "warning",
        params: { count: piped.removed, subject: "ending" },
      });
    }
    const defaultHeadline = headline[survey.defaultLanguage] ?? "";
    if (!hasTextContent(defaultHeadline)) return [await this.defaultEnding()];
    return [{ id: createId(), type: "endScreen", headline: this.filled(headline, defaultHeadline).text }];
  }

  /**
   * The ending the editor gives a new survey, without its link, reported: a file with no end message
   * of its own relied on Qualtrics' default one, and a survey with no ending should not be published.
   * A language Formbricks has no strings for keeps both texts empty, like any missing translation.
   */
  private async defaultEnding(): Promise<TQsfDraftEnding> {
    this.issues.push({ code: "ending_added", severity: "info", params: { subject: "ending" } });
    const texts = await getDefaultEndingTexts(this.languageCodes);
    const headline: TQsfLocaleText = {};
    const subheader: TQsfLocaleText = {};
    for (const [index, code] of this.languageCodes.entries()) {
      const text = texts[index];
      headline[code] = text?.headline ?? "";
      subheader[code] = text?.subheader ?? "";
      if (!text) this.missingCounts.set(code, (this.missingCounts.get(code) ?? 0) + 2);
    }
    return { id: createId(), type: "endScreen", headline, subheader };
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

export function assembleQsfDraft(params: TAssembleQsfDraftParams): Promise<TQsfAssembly> {
  return new QsfAssembler(params).assemble();
}
