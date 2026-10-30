import type { TFunction } from "i18next";
import type { TI18nString } from "@formbricks/types/i18n";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import type { TSurveyElement } from "@formbricks/types/surveys/elements";
import type { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { isI18nObject } from "@/lib/i18n/utils";

/**
 * Every text a survey shows a respondent, walked once, in survey order, each keyed by the ids of what
 * holds it. The Manage translations modal and the Excel export are both views over this walk: they
 * differ in which texts they keep and how they show them, never in what a survey's texts are.
 */

/** A text's own field on whatever holds it: an element, a block, the welcome card or an ending. */
export type TSurveyTextProperty =
  | "headline"
  | "subheader"
  | "html"
  | "buttonLabel"
  | "backButtonLabel"
  | "imageAltText"
  | "placeholder"
  | "label"
  | "lowerLabel"
  | "upperLabel"
  | "ctaButtonLabel"
  | "otherOptionPlaceholder";

export const ADDRESS_SUB_FIELDS = [
  "addressLine1",
  "addressLine2",
  "city",
  "state",
  "zip",
  "country",
] as const;
export const CONTACT_INFO_SUB_FIELDS = ["firstName", "lastName", "email", "phone", "company"] as const;

export type TSurveyTextSubField =
  | (typeof ADDRESS_SUB_FIELDS)[number]
  | (typeof CONTACT_INFO_SUB_FIELDS)[number];

/** What a text is, relative to what holds it. `index` is the 0-based position in its list. */
export type TSurveyTextField =
  | { kind: "property"; property: TSurveyTextProperty }
  | { kind: "choice"; choiceId: string; index: number; property: "label" | "imageAltText" }
  | { kind: "matrixRow"; rowId: string; index: number }
  | { kind: "matrixColumn"; columnId: string; index: number }
  | { kind: "subField"; subField: TSurveyTextSubField };

/** What holds a text. Indexes are 0-based positions in the survey. */
export type TSurveyTextOwner =
  | { kind: "welcomeCard" }
  | { kind: "block"; blockId: string; blockIndex: number }
  | {
      kind: "element";
      blockId: string;
      blockIndex: number;
      element: TSurveyElement;
      elementIndex: number;
    }
  | { kind: "ending"; endingId: string; endingIndex: number };

export interface TSurveyText {
  /**
   * Stable across reorders, built from ids only (ADR 0017): `element.<elementId>.choice.<choiceId>.label`,
   * `block.<blockId>.buttonLabel`, `ending.<endingId>.headline`, `welcomeCard.headline`. Ids are
   * percent-encoded, dots included, so a key always splits back into its segments.
   */
  key: string;
  /** The dotted index path to the text inside the survey, for writing a value back in place. */
  path: string;
  owner: TSurveyTextOwner;
  field: TSurveyTextField;
  /**
   * The stored text. Undefined only for an other-option placeholder the survey never stored: the
   * respondent then sees the survey renderer's default, which the walk has no opinion on.
   */
  value: TI18nString | undefined;
  /** Stored as HTML from the rich-text editor, not as plain text. */
  isRichText: boolean;
}

const RICH_TEXT_PROPERTIES = new Set<TSurveyTextProperty>(["headline", "subheader", "html"]);

const encodeKeySegment = (id: string): string => encodeURIComponent(id).replaceAll(".", "%2E");

const keyOf = (...segments: string[]): string => segments.join(".");

const ownerKey = (owner: TSurveyTextOwner): string => {
  switch (owner.kind) {
    case "welcomeCard":
      return "welcomeCard";
    case "block":
      return keyOf("block", encodeKeySegment(owner.blockId));
    case "element":
      return keyOf("element", encodeKeySegment(owner.element.id));
    case "ending":
      return keyOf("ending", encodeKeySegment(owner.endingId));
  }
};

const fieldKey = (field: TSurveyTextField): string => {
  switch (field.kind) {
    case "property":
      return field.property;
    case "choice":
      return keyOf("choice", encodeKeySegment(field.choiceId), field.property);
    case "matrixRow":
      return keyOf("row", encodeKeySegment(field.rowId), "label");
    case "matrixColumn":
      return keyOf("column", encodeKeySegment(field.columnId), "label");
    case "subField":
      return keyOf(field.subField, "placeholder");
  }
};

/** Whether a text holds anything a respondent would read in the default language. */
export const hasDefaultText = (text: TSurveyText): boolean => {
  const defaultText = text.value?.default ?? "";
  return (text.isRichText ? getTextContent(defaultText) : defaultText).trim() !== "";
};

class SurveyTextCollector {
  readonly texts: TSurveyText[] = [];

  constructor(
    private readonly owner: TSurveyTextOwner,
    private readonly basePath: string
  ) {}

  private push(field: TSurveyTextField, relativePath: string, value: unknown, isRichText: boolean) {
    this.texts.push({
      key: keyOf(ownerKey(this.owner), fieldKey(field)),
      path: this.basePath ? `${this.basePath}.${relativePath}` : relativePath,
      owner: this.owner,
      field,
      value: isI18nObject(value) ? value : undefined,
      isRichText,
    });
  }

  /** A property holding an i18n text; absent or malformed ones are skipped. */
  property(holder: object, property: TSurveyTextProperty) {
    const value: unknown = (holder as Record<string, unknown>)[property];
    if (!isI18nObject(value)) return;
    this.push({ kind: "property", property }, property, value, RICH_TEXT_PROPERTIES.has(property));
  }

  /**
   * The placeholder of an "Other" choice's text box. Present whenever the element offers "Other", stored
   * or not, so a translator sees it even before anyone typed a default.
   */
  otherOptionPlaceholder(element: TSurveyElement & { choices: { id: string }[] }) {
    if (!element.choices.some((choice) => choice.id === "other")) return;
    const value: unknown = (element as Record<string, unknown>).otherOptionPlaceholder;
    this.push(
      { kind: "property", property: "otherOptionPlaceholder" },
      "otherOptionPlaceholder",
      value,
      false
    );
  }

  choice(choiceId: string, index: number, property: "label" | "imageAltText", value: unknown) {
    if (!isI18nObject(value)) return;
    this.push({ kind: "choice", choiceId, index, property }, `choices.${index}.${property}`, value, false);
  }

  matrix(kind: "matrixRow" | "matrixColumn", id: string, index: number, value: unknown) {
    if (!isI18nObject(value)) return;
    const field: TSurveyTextField =
      kind === "matrixRow" ? { kind, rowId: id, index } : { kind, columnId: id, index };
    this.push(field, `${kind === "matrixRow" ? "rows" : "columns"}.${index}.label`, value, false);
  }

  subField(subField: TSurveyTextSubField, config: { placeholder?: unknown } | undefined) {
    if (!isI18nObject(config?.placeholder)) return;
    this.push({ kind: "subField", subField }, `${subField}.placeholder`, config.placeholder, false);
  }
}

const walkElement = (element: TSurveyElement, collect: SurveyTextCollector) => {
  collect.property(element, "headline");
  collect.property(element, "subheader");
  collect.property(element, "imageAltText");

  switch (element.type) {
    case TSurveyElementTypeEnum.OpenText:
      collect.property(element, "placeholder");
      break;
    case TSurveyElementTypeEnum.Consent:
      collect.property(element, "label");
      break;
    case TSurveyElementTypeEnum.MultipleChoiceSingle:
    case TSurveyElementTypeEnum.MultipleChoiceMulti:
    case TSurveyElementTypeEnum.Ranking:
      element.choices.forEach((choice, index) => collect.choice(choice.id, index, "label", choice.label));
      collect.otherOptionPlaceholder(element);
      break;
    case TSurveyElementTypeEnum.PictureSelection:
      element.choices.forEach((choice, index) =>
        collect.choice(choice.id, index, "imageAltText", choice.imageAltText)
      );
      break;
    case TSurveyElementTypeEnum.NPS:
    case TSurveyElementTypeEnum.Rating:
    case TSurveyElementTypeEnum.CSAT:
    case TSurveyElementTypeEnum.CES:
      collect.property(element, "lowerLabel");
      collect.property(element, "upperLabel");
      break;
    case TSurveyElementTypeEnum.CTA:
      collect.property(element, "ctaButtonLabel");
      break;
    case TSurveyElementTypeEnum.Date:
      collect.property(element, "html");
      break;
    case TSurveyElementTypeEnum.Matrix:
      element.rows.forEach((row, index) => collect.matrix("matrixRow", row.id, index, row.label));
      element.columns.forEach((column, index) =>
        collect.matrix("matrixColumn", column.id, index, column.label)
      );
      break;
    case TSurveyElementTypeEnum.Address:
      ADDRESS_SUB_FIELDS.forEach((subField) => collect.subField(subField, element[subField]));
      break;
    case TSurveyElementTypeEnum.ContactInfo:
      CONTACT_INFO_SUB_FIELDS.forEach((subField) => collect.subField(subField, element[subField]));
      break;
    case TSurveyElementTypeEnum.FileUpload:
    case TSurveyElementTypeEnum.Cal:
      break;
  }
};

/**
 * Every text the survey can show, in the order a respondent meets it: the welcome card (when enabled),
 * then each block's button labels and its elements, then the endings that show a screen. Texts are
 * returned whether or not they hold anything, so each caller decides what an empty one means; see
 * {@link hasDefaultText}.
 */
export const walkSurveyTexts = (survey: TSurvey): TSurveyText[] => {
  const texts: TSurveyText[] = [];

  if (survey.welcomeCard.enabled) {
    const collect = new SurveyTextCollector({ kind: "welcomeCard" }, "welcomeCard");
    collect.property(survey.welcomeCard, "headline");
    collect.property(survey.welcomeCard, "subheader");
    collect.property(survey.welcomeCard, "buttonLabel");
    texts.push(...collect.texts);
  }

  survey.blocks.forEach((block, blockIndex) => {
    const blockPath = `blocks.${blockIndex}`;
    const collectBlock = new SurveyTextCollector({ kind: "block", blockId: block.id, blockIndex }, blockPath);
    collectBlock.property(block, "buttonLabel");
    collectBlock.property(block, "backButtonLabel");
    texts.push(...collectBlock.texts);

    block.elements.forEach((element, elementIndex) => {
      const collect = new SurveyTextCollector(
        { kind: "element", blockId: block.id, blockIndex, element, elementIndex },
        `${blockPath}.elements.${elementIndex}`
      );
      walkElement(element, collect);
      texts.push(...collect.texts);
    });
  });

  survey.endings.forEach((ending, endingIndex) => {
    if (ending.type !== "endScreen") return;
    const collect = new SurveyTextCollector(
      { kind: "ending", endingId: ending.id, endingIndex },
      `endings.${endingIndex}`
    );
    collect.property(ending, "headline");
    collect.property(ending, "subheader");
    collect.property(ending, "imageAltText");
    collect.property(ending, "buttonLabel");
    texts.push(...collect.texts);
  });

  return texts;
};

/** The name of a text's field, as the editor labels it: "Headline", "Choice 2", "Row 1", … */
export const getSurveyTextFieldLabel = (field: TSurveyTextField, t: TFunction): string => {
  switch (field.kind) {
    case "choice":
      return field.property === "label"
        ? t("common.choice_n", { n: field.index + 1 })
        : t("workspace.surveys.edit.image_alt_text_choice_n", { n: field.index + 1 });
    case "matrixRow":
      return t("common.row_n", { n: field.index + 1 });
    case "matrixColumn":
      return t("common.column_n", { n: field.index + 1 });
    case "subField":
      return t("common.field_placeholder", { field: field.subField });
    case "property":
      return getPropertyLabel(field.property, t);
  }
};

const getPropertyLabel = (property: TSurveyTextProperty, t: TFunction): string => {
  switch (property) {
    case "headline":
      return t("common.headline");
    case "subheader":
      return t("common.subheader");
    case "html":
      return t("common.html");
    case "buttonLabel":
      return t("workspace.surveys.edit.button_label");
    case "backButtonLabel":
      return t("workspace.surveys.edit.back_button_label");
    case "imageAltText":
      return t("workspace.surveys.edit.image_alt_text");
    case "placeholder":
      return t("common.placeholder");
    case "label":
      return t("common.label");
    case "lowerLabel":
      return t("workspace.surveys.edit.lower_label");
    case "upperLabel":
      return t("workspace.surveys.edit.upper_label");
    case "ctaButtonLabel":
      return t("workspace.surveys.edit.cta_button_label");
    case "otherOptionPlaceholder":
      return t("common.other_placeholder");
  }
};
