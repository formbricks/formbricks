import { importInfo, importWarning } from "../../report";
import type { TImportIssue } from "../../types";
import type { QsfIdRegistry } from "./id-registry";
import { splitHeadline, stripHtml } from "./strip-html";
import type { TQsfChoice, TQsfQuestion } from "./types";

/** Public v3 shapes (locale-code maps), loose because element fields vary by type. */
export type TQsfI18n = Record<string, string>;
export type TQsfMappedElement = Record<string, unknown> & { id: string; type: string; headline: TQsfI18n };

export type TQsfQuestionMappingContext = {
  defaultLanguageCode: string;
  /** Additional languages the document declares; every translatable map must carry all of them. */
  languageCodes: readonly string[];
  idRegistry: QsfIdRegistry;
};

export type TQsfQuestionMapping = {
  elements: TQsfMappedElement[];
  issues: TImportIssue[];
  /** QSF choice id → Formbricks choice id, for the piped-text and logic passes. */
  choiceIdMap: Record<string, string>;
};

const MAX_HEADLINE_LENGTH = 500;
const RATING_RANGES = [3, 4, 5, 6, 7, 10] as const;
const MAX_RANKING_CHOICES = 25;

const SINGLE_SELECTORS = new Set(["SAVR", "SAHR", "SACOL", "SB", "DL"]);
const MULTI_SELECTORS = new Set(["MAVR", "MAHR", "MACOL", "MSB"]);
const CONTENT_TYPE_INPUT: Record<string, "email" | "phone" | "number" | "url"> = {
  ValidEmail: "email",
  ValidPhone: "phone",
  ValidNumber: "number",
  ValidUrl: "url",
  ValidUSPhone: "phone",
};
const UNSUPPORTED_TYPES: Record<string, string> = {
  CS: "Constant sum",
  Timing: "Timing",
  Meta: "Meta info",
  Captcha: "Captcha",
  HotSpot: "Hot spot",
  HeatMap: "Heat map",
  DD: "Drill down",
  PGR: "Pick, group and rank",
  SS: "Graphic slider",
  SBS: "Side by side",
  Draw: "Signature",
  HL: "Highlight",
  TextGraphic: "Text/graphic",
  GAP: "Gap analysis",
  Sig: "Signature",
};

class QuestionMapper {
  readonly issues: TImportIssue[] = [];
  readonly choiceIdMap: Record<string, string> = {};
  private missingTranslation = false;

  constructor(
    private readonly question: TQsfQuestion,
    private readonly ctx: TQsfQuestionMappingContext
  ) {}

  /** Build a public locale map: default text plus one entry per declared language (empty when missing). */
  i18n(defaultText: string, translated: (code: string) => string | undefined): TQsfI18n {
    const map: TQsfI18n = { [this.ctx.defaultLanguageCode]: defaultText };
    for (const code of this.ctx.languageCodes) {
      const value = translated(code);
      if (value === undefined) {
        this.missingTranslation = true;
        map[code] = "";
      } else {
        map[code] = stripHtml(value);
      }
    }
    return map;
  }

  translatedText(code: string): string | undefined {
    return this.question.translations[code]?.text;
  }

  translatedChoice(list: "choices" | "answers", id: string): (code: string) => string | undefined {
    return (code) => this.question.translations[code]?.[list]?.[id];
  }

  headlineFields(): { headline: TQsfI18n; subheader?: TQsfI18n } {
    const full = stripHtml(this.question.text);
    const { headline, rest } = splitHeadline(full, MAX_HEADLINE_LENGTH);
    if (rest !== null) {
      this.issues.push(
        importInfo({
          code: "text_truncated",
          sourceRef: this.question.qid,
          vars: { max: MAX_HEADLINE_LENGTH },
        })
      );
    }
    return {
      headline: this.i18n(headline, (code) => {
        const translated = this.translatedText(code);
        return translated === undefined
          ? undefined
          : splitHeadline(stripHtml(translated), MAX_HEADLINE_LENGTH).headline;
      }),
      ...(rest ? { subheader: this.i18n(rest, () => undefined) } : {}),
    };
  }

  base(id: string, type: string, overrides: Record<string, unknown> = {}): TQsfMappedElement {
    return {
      id,
      type,
      ...this.headlineFields(),
      required: this.question.validation.forceResponse === "ON",
      ...overrides,
    };
  }

  claimId(): string {
    return this.ctx.idRegistry.claim(this.question.exportTag, this.question.qid);
  }

  choices(
    source: TQsfChoice[],
    list: "choices" | "answers",
    prefix: string
  ): { id: string; label: TQsfI18n }[] {
    let hasOther = false;
    return source.map((choice) => {
      const isOther = list === "choices" && choice.textEntry && !hasOther;
      if (isOther) hasOther = true;
      const id = isOther ? "other" : `${prefix}_${choice.id}`;
      this.choiceIdMap[choice.id] = id;
      return { id, label: this.i18n(stripHtml(choice.display), this.translatedChoice(list, choice.id)) };
    });
  }

  shuffleOption(): Record<string, unknown> {
    const type = this.question.randomization?.type;
    if (type === "All") return { shuffleOption: "all" };
    if (type === "ExceptLast") return { shuffleOption: "exceptLast" };
    return {};
  }

  unsupported(label: string): TQsfMappedElement[] {
    this.issues.push(
      importWarning({
        code: "unsupported_question_type",
        sourceRef: this.question.qid,
        vars: { type: label },
      })
    );
    return [];
  }

  approximated(from: string, to: string): void {
    this.issues.push(
      importInfo({ code: "type_approximated", sourceRef: this.question.qid, vars: { from, to } })
    );
  }

  openText(overrides: Record<string, unknown> = {}): TQsfMappedElement {
    const { validation } = this.question;
    const inputType = validation.contentType ? CONTENT_TYPE_INPUT[validation.contentType] : undefined;
    const hasCharLimit = validation.minChars !== null || validation.maxChars !== null;
    return this.base(this.claimId(), "openText", {
      inputType: inputType ?? "text",
      longAnswer: false,
      charLimit: hasCharLimit
        ? {
            enabled: true,
            ...(validation.minChars !== null ? { min: validation.minChars } : {}),
            ...(validation.maxChars !== null ? { max: validation.maxChars } : {}),
          }
        : { enabled: false },
      ...overrides,
    });
  }

  mapMultipleChoice(): TQsfMappedElement[] {
    const selector = this.question.selector ?? "";
    if (selector === "NPS") {
      return [this.base(this.claimId(), "nps", { isColorCodingEnabled: false })];
    }

    if (this.question.choices.length < 2) {
      this.approximated(`MC/${selector || "?"}`, "openText");
      return [this.openText()];
    }

    const isMulti = MULTI_SELECTORS.has(selector);
    if (!isMulti && !SINGLE_SELECTORS.has(selector)) {
      this.approximated(`MC/${selector || "?"}`, "multipleChoiceSingle");
    }

    const choices = this.choices(this.question.choices, "choices", "choice");
    const hasOther = choices.some((choice) => choice.id === "other");
    return [
      this.base(this.claimId(), isMulti ? "multipleChoiceMulti" : "multipleChoiceSingle", {
        choices,
        ...this.shuffleOption(),
        ...(hasOther ? { otherOptionPlaceholder: this.i18n("Please specify", () => "Please specify") } : {}),
        ...(selector === "DL" ? { displayType: "dropdown" } : {}),
      }),
    ];
  }

  mapTextEntry(): TQsfMappedElement[] {
    const selector = this.question.selector ?? "SL";
    if (selector === "FORM" && this.question.choices.length > 0) {
      const { headline } = this.headlineFields();
      return this.question.choices.map((field) => {
        const id = this.ctx.idRegistry.claim(
          `${this.question.exportTag}_${field.id}`,
          `${this.question.qid}_${field.id}`
        );
        return {
          ...this.openText({ id }),
          headline: this.i18n(stripHtml(field.display), this.translatedChoice("choices", field.id)),
          subheader: headline,
        };
      });
    }

    return [this.openText(selector === "ML" || selector === "ESTB" ? { longAnswer: true } : {})];
  }

  mapMatrix(): TQsfMappedElement[] {
    const subSelector = this.question.subSelector ?? "SingleAnswer";
    if (this.question.selector !== "Likert" || !["SingleAnswer", "Bipolar"].includes(subSelector)) {
      return this.unsupported(`Matrix/${this.question.selector ?? "?"}/${subSelector}`);
    }
    if (this.question.choices.length === 0 || this.question.answers.length === 0) {
      return this.unsupported("Matrix without rows or columns");
    }

    return [
      this.base(this.claimId(), "matrix", {
        rows: this.choices(this.question.choices, "choices", "row"),
        columns: this.choices(this.question.answers, "answers", "column"),
        shuffleOption: "none",
      }),
    ];
  }

  mapSlider(): TQsfMappedElement[] {
    const selector = this.question.selector ?? "HSLIDER";
    const statements = this.question.choices.length > 0 ? this.question.choices : [null];
    const isStar = selector === "STAR";
    let range: (typeof RATING_RANGES)[number] = 5;

    if (!isStar) {
      const max = this.question.configuration.sliderMax ?? 10;
      const clamped = RATING_RANGES.reduce((best, candidate) =>
        Math.abs(candidate - max) < Math.abs(best - max) ? candidate : best
      );
      if (clamped !== max) this.approximated(`Slider max ${max}`, `rating range ${clamped}`);
      range = clamped;
    }

    return statements.map((statement, index) => {
      const id =
        statements.length === 1
          ? this.claimId()
          : this.ctx.idRegistry.claim(
              `${this.question.exportTag}_${statement?.id ?? index + 1}`,
              `${this.question.qid}_${index + 1}`
            );
      const element = this.base(id, "rating", {
        scale: isStar ? "star" : "number",
        range,
        isColorCodingEnabled: false,
      });
      if (statement && statements.length > 1) {
        return {
          ...element,
          headline: this.i18n(stripHtml(statement.display), this.translatedChoice("choices", statement.id)),
          subheader: element.headline,
        };
      }
      return element;
    });
  }

  mapRanking(): TQsfMappedElement[] {
    if (this.question.choices.length < 2) return this.unsupported("Rank order with fewer than 2 options");

    let source = this.question.choices;
    if (source.length > MAX_RANKING_CHOICES) {
      source = source.slice(0, MAX_RANKING_CHOICES);
      this.issues.push(
        importWarning({
          code: "choices_truncated",
          sourceRef: this.question.qid,
          vars: { max: MAX_RANKING_CHOICES },
        })
      );
    }

    return [
      this.base(this.claimId(), "ranking", {
        choices: this.choices(source, "choices", "choice").map((choice) =>
          choice.id === "other" ? { ...choice, id: `choice_other` } : choice
        ),
        ...this.shuffleOption(),
      }),
    ];
  }

  mapDescriptive(): TQsfMappedElement[] {
    // The v3 CTA carries headline, subheader and a button; Qualtrics descriptive text becomes exactly that.
    return [
      this.base(this.claimId(), "cta", {
        required: false,
        buttonExternal: false,
        ctaButtonLabel: this.i18n("Next", () => "Next"),
      }),
    ];
  }

  map(): TQsfMappedElement[] {
    const { type } = this.question;
    switch (type) {
      case "MC":
        return this.mapMultipleChoice();
      case "TE":
        return this.mapTextEntry();
      case "Matrix":
        return this.mapMatrix();
      case "Slider":
        return this.mapSlider();
      case "RO":
        return this.mapRanking();
      case "DB":
        return this.mapDescriptive();
      case "FileUpload":
        return [this.base(this.claimId(), "fileUpload", { allowMultipleFiles: false })];
      default:
        return this.unsupported(UNSUPPORTED_TYPES[type] ?? type);
    }
  }

  finish(elements: TQsfMappedElement[]): TQsfQuestionMapping {
    if (this.missingTranslation && elements.length > 0) {
      this.issues.push(
        importInfo({
          code: "translation_missing",
          sourceRef: this.question.qid,
          vars: { code: this.ctx.languageCodes.join(", ") },
        })
      );
    }
    return { elements, issues: this.issues, choiceIdMap: this.choiceIdMap };
  }
}

/** One QSF question → zero or more Formbricks elements (public v3 shape), deterministically. */
export function mapQsfQuestion(question: TQsfQuestion, ctx: TQsfQuestionMappingContext): TQsfQuestionMapping {
  const mapper = new QuestionMapper(question, ctx);
  return mapper.finish(mapper.map());
}
