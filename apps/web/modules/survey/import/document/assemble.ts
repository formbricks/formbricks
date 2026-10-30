import { createId } from "@paralleldrive/cuid2";
import type { TSurveyBlockLogic } from "@formbricks/types/surveys/blocks";
import type { TConditionGroup, TSingleCondition } from "@formbricks/types/surveys/logic";
import type { TSurveyLanguage } from "@formbricks/types/surveys/types";
import { V3_SURVEY_MAX_LANGUAGES } from "@/app/api/v3/surveys/schemas";
import { disambiguateLabels } from "../core/choice-labels";
import { getDefaultEndingTexts } from "../core/default-ending";
import type {
  TDraftChoice,
  TDraftElementBase,
  TSurveyImportAssembly,
  TSurveyImportDraft,
  TSurveyImportDraftBlock,
  TSurveyImportDraftElement,
  TSurveyImportDraftEnding,
  TSurveyImportLocaleText,
} from "../core/draft";
import { createSlicer } from "../core/event-loop";
import { SurveyImportIdRegistry } from "../core/id-registry";
import { languageSettingsFor } from "../core/language-settings";
import type { TSurveyImportPipelineIssue } from "../core/report";
import { type TSanitizedTexts, type TSurveyImportText, sanitizeImportTexts } from "../core/sanitize-text";
import { SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION } from "../limits";
import {
  type TDocumentLanguages,
  type TDocumentPlannedEntry,
  type TDocumentPlannedOption,
  type TDocumentText,
  collapseWhitespace,
} from "./plan-checks";
import type { TDocumentPlanRule } from "./plan-schema";

/**
 * The assembly of a document import (ENG-6852): the checked plan's entries become the draft the dialog
 * creates — the locale-keyed request shape — and their routing becomes logic.
 *
 * Every text is the file's, as the checks read it from its cell; here it is sanitized like any imported
 * text (plain text, so markup in a cell shows as typed). Ids are the import's own: element ids from the
 * IDs the file gives its questions through `SurveyImportIdRegistry`, every choice, block and ending id
 * from `createId()`.
 *
 * Blocks follow the file's sections: consecutive questions of one section share a block, a question
 * outside any is a block of its own. Routing then splits blocks where logic needs a block to start or
 * end — a question asked only if a condition holds starts one, a question that jumps ends one, a jump's
 * target starts one — and becomes logic:
 *
 * - `skipTo`: a rule on the question's block, jumping to the target's block (or the ending) when the
 *   condition holds;
 * - `showIf`: Formbricks has no conditions on showing a block, so the block before it decides where to
 *   go next: to the first of the following conditional blocks whose condition holds, else past them.
 *
 * Every rule the draft carries is reported for checking (`logic_imported`); one the draft cannot carry
 * — its question is not in the draft, or comes later, or its answers are not the question's — is
 * reported as `logic_not_imported`, with the AI's note on it.
 */

export interface TAssembleDocumentDraftParams {
  entries: readonly TDocumentPlannedEntry[];
  languages: TDocumentLanguages;
  name: string;
  workspaceId: string;
  /** Entries the final gate refused on a first pass, by ref. */
  excludedRefs?: ReadonlySet<string>;
  /** Leave every routing rule out, reported as not imported: the gate refused the logic built. */
  withoutLogic?: boolean;
  signal: AbortSignal;
}

/** The text keys of one entry, for sanitizing: `R5.headline`, `R5.o2`, … */
const textKey = (ref: string, slot: string): string => `${ref}.${slot}`;

/** Every text of the entries, keyed for `sanitizeImportTexts`. */
function collectTexts(entries: readonly TDocumentPlannedEntry[]): Map<string, TSurveyImportText> {
  const texts = new Map<string, TSurveyImportText>();
  const add = (ref: string, slot: string, text: TDocumentText | null) => {
    if (text) texts.set(textKey(ref, slot), { format: "plain", questionRef: ref, byLanguage: new Map(text) });
  };
  for (const entry of entries) {
    add(entry.ref, "headline", entry.headline);
    add(entry.ref, "subheader", entry.subheader);
    add(entry.ref, "lower", entry.lowerLabel);
    add(entry.ref, "upper", entry.upperLabel);
    entry.options.forEach((option, index) => add(entry.ref, `o${index}`, option.text));
    entry.columns.forEach((column, index) => add(entry.ref, `c${index}`, column.text));
  }
  return texts;
}

/** Where routing needs a block boundary, by entry ref. */
interface TBoundaries {
  startsBlock: Set<string>;
  endsBlock: Set<string>;
}

/** A resolved condition on an earlier question, by element id. */
type TCondition = TSingleCondition | TConditionGroup;

interface TResolvedRule {
  entry: TDocumentPlannedEntry;
  index: number;
  kind: TDocumentPlanRule["kind"];
  /** The question the condition reads. */
  sourceRef: string;
  conditions: TCondition[];
  /** `skipTo`: the entry jumped to, or `end`. */
  target: TDocumentPlannedEntry | "end" | null;
}

/** The label a question is routed to by: its ID, any case, whitespace collapsed. */
const routingKey = (label: string): string => collapseWhitespace(label).toLowerCase();

const singleCondition = (
  elementId: string,
  operator: TSingleCondition["operator"],
  value?: string | number | string[]
): TSingleCondition => ({
  id: createId(),
  leftOperand: { type: "element", value: elementId },
  operator,
  ...(value === undefined ? {} : { rightOperand: { type: "static", value } }),
});

/**
 * A group of the conditions, each a copy with ids of its own: a condition can be tested from several
 * blocks (a conditional block's gate is on every block before it in its run), and no two rules may
 * share a condition's id.
 */
const group = (connector: "and" | "or", conditions: readonly TCondition[]): TConditionGroup => ({
  id: createId(),
  connector,
  conditions: conditions.map(withFreshIds),
});

function withFreshIds(condition: TCondition): TCondition {
  return "conditions" in condition
    ? group(condition.connector, condition.conditions)
    : { ...condition, id: createId() };
}

class DocumentDraftBuilder {
  private readonly issues: TSurveyImportPipelineIssue[] = [];
  private readonly languageCodes: string[];
  private readonly surveyLanguages: TSurveyLanguage[];
  private readonly ids = new SurveyImportIdRegistry();
  /** The element each question became, and the choice ids each of its options became. */
  private readonly elementIds = new Map<string, string>();
  private readonly choiceIds = new Map<string, string[]>();
  private readonly elementsByRef = new Map<string, TSurveyImportDraftElement>();
  private texts: TSanitizedTexts = { byKey: new Map(), plainDefault: new Map(), issues: [] };
  private readonly missingTranslations = new Map<string, number>();

  constructor(private readonly params: TAssembleDocumentDraftParams) {
    this.languageCodes = params.languages.codes.slice(0, V3_SURVEY_MAX_LANGUAGES);
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

  async build(): Promise<TSurveyImportAssembly> {
    const { params } = this;
    const entries = params.entries.filter((entry) => !params.excludedRefs?.has(entry.ref));
    this.texts = await sanitizeImportTexts(
      {
        texts: collectTexts(entries),
        defaultLanguage: this.languageCodes[0],
        endingKey: null,
        questionLabel: (ref) => entries.find((entry) => entry.ref === ref)?.label ?? ref,
      },
      params.signal
    );
    this.issues.push(...this.texts.issues);

    const welcome = entries.find((entry) => entry.kind === "welcome");
    const endingEntries = entries.filter((entry) => entry.kind === "ending");
    const questions = entries.filter((entry) => entry !== welcome && entry.kind !== "ending");

    const slice = createSlicer(params.signal);
    const elements: { entry: TDocumentPlannedEntry; element: TSurveyImportDraftElement }[] = [];
    for (const entry of questions) {
      // Yields by elapsed time, by design: a large list should not hold the event loop.
      await slice(); // NOSONAR(typescript:S9382) -- a deliberate yield every slice
      const element = this.buildElement(entry);
      this.elementsByRef.set(entry.ref, element);
      elements.push({ entry, element });
    }

    const endings = await this.buildEndings(endingEntries);
    const rules = params.withoutLogic ? this.reportAllNotImported(questions) : this.resolveRules(questions);
    const blocks = this.buildBlocks(elements, rules, endings[0]?.id ?? null);

    const languages = this.languageCodes.map((code, index) => ({
      code,
      default: index === 0,
      enabled: index === 0 || !this.missingTranslations.has(code),
    }));
    for (const [language, count] of this.missingTranslations) {
      this.issues.push({ code: "translation_missing", severity: "warning", params: { language, count } });
    }

    const document: TSurveyImportDraft = {
      workspaceId: params.workspaceId,
      name: params.name,
      type: "link",
      status: "draft",
      defaultLanguage: this.languageCodes[0],
      languages,
      ...(welcome ? { welcomeCard: this.buildWelcome(welcome) } : {}),
      blocks,
      endings,
      hiddenFields: { enabled: true, fieldIds: [] },
      ...languageSettingsFor(languages.filter((language) => language.enabled).length),
    };

    const refByElement = new Map([...this.elementIds].map(([ref, id]) => [id, ref]));
    return {
      document,
      issues: this.issues,
      elementRefs: blocks.map((block) =>
        block.elements.map((element) => refByElement.get(element.id) ?? element.id)
      ),
    };
  }

  /** A text slot in every language; a language the file has no text in gets an empty one, counted. */
  private localeText(ref: string, slot: string): TSurveyImportLocaleText {
    const sanitized = this.texts.byKey.get(textKey(ref, slot));
    const text: TSurveyImportLocaleText = {};
    this.languageCodes.forEach((code, index) => {
      const value = sanitized?.get(code) ?? "";
      if (index > 0 && value === "") {
        this.missingTranslations.set(code, (this.missingTranslations.get(code) ?? 0) + 1);
      }
      text[code] = value;
    });
    return text;
  }

  private optionalText(
    ref: string,
    slot: string,
    source: TDocumentText | null
  ): TSurveyImportLocaleText | undefined {
    return source && source.size > 0 ? this.localeText(ref, slot) : undefined;
  }

  private buildChoices(
    entry: TDocumentPlannedEntry,
    options: readonly TDocumentPlannedOption[],
    prefix: "o" | "c",
    keepOther: boolean
  ): TDraftChoice[] {
    const capped = options.slice(0, SURVEY_IMPORT_MAX_OPTIONS_PER_QUESTION);
    // Formbricks keeps the "Other" choice last, under its fixed id.
    const otherIndex = keepOther ? capped.findIndex((option) => option.isOther) : -1;
    const order = capped.map((_option, index) => index).filter((index) => index !== otherIndex);
    if (otherIndex >= 0) order.push(otherIndex);

    const choices = order.map((index) => ({
      id: index === otherIndex ? "other" : createId(),
      label: this.localeText(entry.ref, `${prefix}${index}`),
    }));
    if (disambiguateLabels(choices, this.languageCodes, this.surveyLanguages)) {
      this.issues.push({
        code: "choice_label_renamed",
        severity: "info",
        questionTag: entry.label ?? entry.ref,
        questionRef: entry.ref,
      });
    }
    if (prefix === "o") {
      // By the option's place in the file, for routing: its code or text names it there.
      const byFileOrder: string[] = [];
      order.forEach((index, position) => {
        byFileOrder[index] = choices[position].id;
      });
      this.choiceIds.set(entry.ref, byFileOrder);
    }
    return choices;
  }

  private buildElement(entry: TDocumentPlannedEntry): TSurveyImportDraftElement {
    const id = this.ids.claim(entry.label ?? "", `q${this.elementIds.size + 1}`);
    this.elementIds.set(entry.ref, id);
    if (entry.unsplitCell) {
      this.issues.push({
        code: "text_not_split",
        severity: "warning",
        questionTag: entry.label ?? entry.ref,
        questionRef: entry.ref,
        params: { cell: entry.unsplitCell },
      });
    }

    const subheader = this.optionalText(entry.ref, "subheader", entry.subheader);
    const base: TDraftElementBase & { subheader?: TSurveyImportLocaleText } = {
      id,
      headline: this.localeText(entry.ref, "headline"),
      required: entry.required,
      isDraft: true,
      ...(subheader ? { subheader } : {}),
    };

    switch (entry.kind) {
      case "multipleChoiceSingle":
      case "multipleChoiceMulti": {
        const choices = this.buildChoices(entry, entry.options, "o", true);
        return {
          ...base,
          type: entry.kind,
          choices,
          shuffleOption: "none",
          displayType: entry.dropdown ? "dropdown" : "list",
        };
      }
      case "ranking":
        return {
          ...base,
          type: "ranking",
          choices: this.buildChoices(entry, entry.options, "o", false),
          shuffleOption: "none",
        };
      case "matrix":
        return {
          ...base,
          type: "matrix",
          rows: this.buildChoices(entry, entry.options, "o", false),
          columns: this.buildChoices(entry, entry.columns, "c", false),
          shuffleOption: "none",
        };
      case "nps":
        return { ...base, type: "nps", isColorCodingEnabled: false, ...this.scaleLabels(entry) };
      case "rating":
      case "csat":
      case "ces":
        return {
          ...base,
          type: entry.kind,
          scale: entry.scale,
          range: entry.range ?? 5,
          isColorCodingEnabled: false,
          ...this.scaleLabels(entry),
        };
      case "date":
        return { ...base, type: "date", format: entry.format };
      case "fileUpload":
        return { ...base, type: "fileUpload", allowMultipleFiles: false };
      case "consent": {
        // The text to agree to is the checkbox's label, not a description above it as well.
        const { subheader: _subheader, ...consent } = base;
        return { ...consent, type: "consent", label: subheader ?? base.headline };
      }
      case "cta":
      case "welcome":
        return { ...base, type: "cta", buttonExternal: false };
      default:
        return {
          ...base,
          type: "openText",
          inputType: entry.inputType,
          longAnswer: entry.inputType === "text",
          charLimit: { enabled: false },
        };
    }
  }

  private scaleLabels(entry: TDocumentPlannedEntry) {
    const lowerLabel = this.optionalText(entry.ref, "lower", entry.lowerLabel);
    const upperLabel = this.optionalText(entry.ref, "upper", entry.upperLabel);
    return { ...(lowerLabel ? { lowerLabel } : {}), ...(upperLabel ? { upperLabel } : {}) };
  }

  private buildWelcome(entry: TDocumentPlannedEntry): NonNullable<TSurveyImportDraft["welcomeCard"]> {
    const subheader = this.optionalText(entry.ref, "subheader", entry.subheader);
    return {
      enabled: true,
      headline: this.localeText(entry.ref, "headline"),
      ...(subheader ? { subheader } : {}),
    };
  }

  /** The file's closing texts, or the editor's default ending, reported, when it has none. */
  private async buildEndings(entries: readonly TDocumentPlannedEntry[]): Promise<TSurveyImportDraftEnding[]> {
    if (entries.length > 0) {
      return entries.map((entry) => {
        const subheader = this.optionalText(entry.ref, "subheader", entry.subheader);
        return {
          id: createId(),
          type: "endScreen",
          headline: this.localeText(entry.ref, "headline"),
          ...(subheader ? { subheader } : {}),
        };
      });
    }

    const defaults = await getDefaultEndingTexts(this.languageCodes);
    this.issues.push({ code: "ending_added", severity: "info", params: { subject: "ending" } });
    const text = (part: "headline" | "subheader"): TSurveyImportLocaleText =>
      Object.fromEntries(this.languageCodes.map((code, index) => [code, defaults[index]?.[part] ?? ""]));
    return [{ id: createId(), type: "endScreen", headline: text("headline"), subheader: text("subheader") }];
  }

  private reportRule(entry: TDocumentPlannedEntry, index: number, imported: boolean): void {
    const description = entry.notes[index];
    this.issues.push({
      code: imported ? "logic_imported" : "logic_not_imported",
      // Imported or not, the user checks it: the report opens itself on a warning.
      severity: "warning",
      questionTag: entry.label ?? entry.ref,
      questionRef: entry.ref,
      ...(description ? { params: { description } } : {}),
    });
  }

  private reportAllNotImported(questions: readonly TDocumentPlannedEntry[]): TResolvedRule[] {
    for (const entry of questions)
      entry.rules.forEach((_rule, index) => this.reportRule(entry, index, false));
    return [];
  }

  /** A question of the draft named by a rule: by the ID the file gives it, or by its line. */
  private findQuestion(
    questions: readonly TDocumentPlannedEntry[],
    name: string
  ): TDocumentPlannedEntry | undefined {
    const key = routingKey(name);
    return (
      questions.find((entry) => entry.ref.toLowerCase() === key && this.elementIds.has(entry.ref)) ??
      questions.find(
        (entry) => entry.label !== null && routingKey(entry.label) === key && this.elementIds.has(entry.ref)
      )
    );
  }

  /** The choice ids a rule's values name on the question it reads, or `null` when one names none. */
  private choicesNamed(question: TDocumentPlannedEntry, values: readonly string[]): string[] | null {
    const ids = this.choiceIds.get(question.ref) ?? [];
    const found: string[] = [];
    for (const value of values) {
      const key = routingKey(value);
      const index = question.options.findIndex(
        (option) =>
          (option.code !== null && routingKey(option.code) === key) ||
          routingKey(option.text.get(this.languageCodes[0]) ?? "") === key
      );
      const id = ids[index];
      if (index < 0 || id === undefined) return null;
      if (!found.includes(id)) found.push(id);
    }
    return found.length > 0 ? found : null;
  }

  /** The condition a rule tests, in the operator Formbricks logic has for its question's type. */
  private buildCondition(question: TDocumentPlannedEntry, rule: TDocumentPlanRule): TCondition | null {
    const elementId = this.elementIds.get(question.ref);
    if (!elementId) return null;
    const { operator, values } = rule;

    if (operator === "isSubmitted" || operator === "isSkipped") {
      if (operator === "isSkipped" && question.required) return null;
      const answerable = !["cta", "consent"].includes(question.kind);
      return answerable ? singleCondition(elementId, operator) : null;
    }

    switch (question.kind) {
      case "multipleChoiceSingle": {
        const ids = this.choicesNamed(question, values);
        if (!ids) return null;
        if (operator === "doesNotEqual")
          return ids.length === 1 ? singleCondition(elementId, "doesNotEqual", ids[0]) : null;
        if (operator === "equals" || operator === "isAnyOf") {
          return ids.length === 1
            ? singleCondition(elementId, "equals", ids[0])
            : singleCondition(elementId, "equalsOneOf", ids);
        }
        return null;
      }
      case "multipleChoiceMulti": {
        const ids = this.choicesNamed(question, values);
        if (!ids) return null;
        if (operator === "doesNotEqual") return singleCondition(elementId, "doesNotIncludeOneOf", ids);
        if (operator === "equals" || operator === "isAnyOf")
          return singleCondition(elementId, "includesOneOf", ids);
        return null;
      }
      case "nps":
      case "rating":
      case "csat":
      case "ces":
        return this.numericCondition(elementId, operator, values);
      case "openText":
        return question.inputType === "number" ? this.numericCondition(elementId, operator, values) : null;
      default:
        return null;
    }
  }

  private numericCondition(
    elementId: string,
    operator: TDocumentPlanRule["operator"],
    values: readonly string[]
  ): TCondition | null {
    const numbers = values.map((value) => Number(collapseWhitespace(value)));
    if (numbers.length === 0 || numbers.some((value) => !Number.isFinite(value))) return null;
    if (operator === "isAnyOf") {
      return numbers.length === 1
        ? singleCondition(elementId, "equals", numbers[0])
        : group(
            "or",
            numbers.map((value) => singleCondition(elementId, "equals", value))
          );
    }
    if (numbers.length !== 1) return null;
    return singleCondition(elementId, operator, numbers[0]);
  }

  /** Every routing rule of the questions, resolved against the draft, or reported as not imported. */
  private resolveRules(questions: readonly TDocumentPlannedEntry[]): TResolvedRule[] {
    const position = new Map(questions.map((entry, index) => [entry.ref, index]));
    const resolved: TResolvedRule[] = [];

    questions.forEach((entry, at) => {
      entry.rules.forEach((rule, index) => {
        const source = this.findQuestion(questions, rule.question);
        const sourceAt = source ? position.get(source.ref) : undefined;
        // A condition reads an answer already given: a question before this one, or itself for a jump.
        const readsEarlier =
          sourceAt !== undefined && (rule.kind === "skipTo" ? sourceAt <= at : sourceAt < at);
        const condition = source && readsEarlier ? this.buildCondition(source, rule) : null;

        let target: TResolvedRule["target"] = null;
        if (rule.kind === "skipTo") {
          const named = rule.target === null ? undefined : rule.target;
          if (named !== undefined && routingKey(named) === "end") target = "end";
          else if (named !== undefined) {
            const found = this.findQuestion(questions, named);
            const foundAt = found ? position.get(found.ref) : undefined;
            target = found && foundAt !== undefined && foundAt > at ? found : null;
          }
        }

        const usable = condition !== null && (rule.kind === "showIf" || target !== null);
        if (usable && source) {
          resolved.push({
            entry,
            index,
            kind: rule.kind,
            sourceRef: source.ref,
            conditions: [condition],
            target,
          });
        } else {
          this.reportRule(entry, index, false);
        }
      });
    });
    return resolved;
  }

  /** Where routing needs blocks to start or end. */
  private boundaries(rules: readonly TResolvedRule[]): TBoundaries {
    const startsBlock = new Set<string>();
    const endsBlock = new Set<string>();
    for (const rule of rules) {
      // A conditional question is a block of its own: a question after it that is asked of everyone
      // must not be skipped with it.
      if (rule.kind === "showIf") {
        startsBlock.add(rule.entry.ref);
        endsBlock.add(rule.entry.ref);
      } else {
        endsBlock.add(rule.entry.ref);
        if (rule.target !== "end" && rule.target !== null) startsBlock.add(rule.target.ref);
      }
    }
    return { startsBlock, endsBlock };
  }

  private buildBlocks(
    elements: readonly { entry: TDocumentPlannedEntry; element: TSurveyImportDraftElement }[],
    rules: readonly TResolvedRule[],
    endingId: string | null
  ): TSurveyImportDraftBlock[] {
    const { startsBlock, endsBlock } = this.boundaries(rules);
    const blocks: (TSurveyImportDraftBlock & { refs: string[]; section: string | null })[] = [];
    let previous: TDocumentPlannedEntry | null = null;
    for (const { entry, element } of elements) {
      const current = blocks.at(-1);
      const joins =
        current !== undefined &&
        previous !== null &&
        entry.section !== null &&
        entry.section === previous.section &&
        !startsBlock.has(entry.ref) &&
        !endsBlock.has(previous.ref);
      if (joins) {
        current.elements.push(element);
        current.refs.push(entry.ref);
      } else {
        blocks.push({
          id: createId(),
          name: entry.section ?? `Block ${blocks.length + 1}`,
          elements: [element],
          refs: [entry.ref],
          section: entry.section,
        });
      }
      previous = entry;
    }

    const blockOf = new Map<string, number>();
    blocks.forEach((block, index) => block.refs.forEach((ref) => blockOf.set(ref, index)));
    const logic = blocks.map((): TSurveyBlockLogic[] => []);
    const fallback: (string | undefined)[] = blocks.map(() => undefined);

    for (const rule of rules) {
      if (rule.kind !== "skipTo") continue;
      const at = blockOf.get(rule.entry.ref);
      const target =
        rule.target === "end"
          ? endingId
          : rule.target
            ? blocks[blockOf.get(rule.target.ref) ?? -1]?.id
            : null;
      if (at === undefined || !target) {
        this.reportRule(rule.entry, rule.index, false);
        continue;
      }
      logic[at].push({
        id: createId(),
        conditions: group("and", rule.conditions),
        actions: [{ id: createId(), objective: "jumpToBlock", target }],
      });
      this.reportRule(rule.entry, rule.index, true);
    }

    this.buildGates(blocks, blockOf, rules, logic, fallback, endingId);

    // A section split by routing keeps its name on every part, numbered: "Journey", "Journey (2)".
    const nameCount = new Map<string, number>();
    for (const block of blocks) {
      const seen = (nameCount.get(block.name) ?? 0) + 1;
      nameCount.set(block.name, seen);
      if (seen > 1) block.name = `${block.name} (${seen})`;
    }

    return blocks.map(({ refs: _refs, section: _section, ...block }, index) => ({
      ...block,
      ...(logic[index].length > 0 ? { logic: logic[index] } : {}),
      ...(logic[index].length > 0 && fallback[index] ? { logicFallback: fallback[index] } : {}),
    }));
  }

  /**
   * `showIf` rules as jumps. A conditional block is reached through the block before the run of
   * conditional blocks it is in: that block jumps to the first of them whose condition holds, else past
   * the run, and each of them on to the next whose condition holds, else past the run. A condition must
   * read a block before the run, which is where it is tested.
   */
  private buildGates(
    blocks: readonly TSurveyImportDraftBlock[],
    blockOf: ReadonlyMap<string, number>,
    rules: readonly TResolvedRule[],
    logic: TSurveyBlockLogic[][],
    fallback: (string | undefined)[],
    endingId: string | null
  ): void {
    const showIf = rules.filter((rule) => rule.kind === "showIf");
    const gated = new Set(showIf.map((rule) => blockOf.get(rule.entry.ref)));
    /** The first block of the run of conditional blocks a block is in. */
    const runStart = (at: number): number => {
      let start = at;
      while (start > 0 && gated.has(start - 1)) start -= 1;
      return start;
    };

    const gates = new Map<number, { conditions: TCondition[]; rules: TResolvedRule[] }>();
    for (const rule of showIf) {
      const at = blockOf.get(rule.entry.ref);
      const sourceAt = blockOf.get(rule.sourceRef);
      if (at === undefined || sourceAt === undefined || at === 0 || sourceAt >= runStart(at)) {
        this.reportRule(rule.entry, rule.index, false);
        continue;
      }
      const gate = gates.get(at) ?? { conditions: [], rules: [] };
      gate.conditions.push(...rule.conditions);
      gate.rules.push(rule);
      gates.set(at, gate);
    }
    for (const gate of gates.values()) {
      for (const rule of gate.rules) this.reportRule(rule.entry, rule.index, true);
    }

    const jump = (to: number): TSurveyBlockLogic => ({
      id: createId(),
      conditions: group("and", gates.get(to)?.conditions ?? []),
      actions: [{ id: createId(), objective: "jumpToBlock", target: blocks[to].id }],
    });
    for (let at = 0; at < blocks.length; at += 1) {
      if (!gates.has(at + 1)) continue;
      let past = at + 1;
      while (gates.has(past)) past += 1;
      // The block after the run, or the ending when the run ends the survey.
      const after = blocks[past]?.id ?? endingId ?? undefined;
      for (let next = at + 1; next < past; next += 1) logic[at].push(jump(next));
      if (after && logic[at].length > 0) fallback[at] = after;
    }
  }
}

/** Assemble the draft from the checked plan's entries, in document order. */
export function assembleDocumentDraft(params: TAssembleDocumentDraftParams): Promise<TSurveyImportAssembly> {
  return new DocumentDraftBuilder(params).build();
}
