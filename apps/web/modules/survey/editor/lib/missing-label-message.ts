import type { TFunction } from "i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/utils";
import { NUMBERED_COLLECTION_LABEL_KEYS, getElementFieldLabel } from "@/modules/survey/editor/lib/validation";
import { getAddressFields, getContactInfoFields } from "@/modules/survey/editor/lib/validation-rules-helpers";

/**
 * A label issue as the survey schema raises it (`validateElementLabels`, `validateCardFieldsForAllLanguages`):
 * `params.missingLabel` marks it, `params.invalidLanguageCodes` lists the languages it is missing in, and
 * the path says where the label sits.
 */
interface TLabelIssue {
  path: PropertyKey[];
  params?: Record<string, unknown>;
}

interface TMissingLabelMessage {
  message: string;
  /** True when the message names languages, so the caller can open the tab where they are translated. */
  hasLanguageList: boolean;
}

/** A contact-info or address subfield, keyed the way the schema puts it in the path ("firstname"). */
const getSubfieldName = (pathKey: string, t: TFunction): string | undefined =>
  [...getContactInfoFields(t), ...getAddressFields(t)].find((field) => field.value.toLowerCase() === pathKey)
    ?.label;

// Literal t() calls rather than a key table, because the translation scanner only sees literal keys.
const getNamedFieldLabel = (field: string, t: TFunction): string => {
  const elementFieldLabel = getElementFieldLabel(field, t);
  if (elementFieldLabel) return elementFieldLabel;

  switch (field) {
    case "headline":
      return t("workspace.surveys.edit.missing_label.question_text");
    case "subheader":
    case "welcomeCardSubheader":
    case "html":
      return t("common.description");
    case "cardHeadline":
      return t("common.note");
    case "placeholder":
      return t("common.placeholder");
    // The consent element's label is moved to `label`; the schema names it `consent.label`.
    case "label":
      return t("workspace.surveys.edit.checkbox_label");
    case "upperLabel":
      return t("workspace.surveys.edit.upper_label");
    case "lowerLabel":
      return t("workspace.surveys.edit.lower_label");
    case "buttonLabel":
      return t("workspace.surveys.edit.next_button_label");
    case "ctaButtonLabel":
    case "endingCardButtonLabel":
      return t("workspace.surveys.edit.button_label");
    default: {
      const subfield = getSubfieldName(field, t);
      return subfield ? t("workspace.surveys.edit.missing_label.subfield_label", { field: subfield }) : field;
    }
  }
};

/** The field the label belongs to, read from the path after the card or element it sits in. */
const getFieldLabel = (fieldPath: PropertyKey[], t: TFunction): string => {
  const [collection, index, nested] = fieldPath;
  const collectionKey =
    typeof collection === "string" ? NUMBERED_COLLECTION_LABEL_KEYS[collection] : undefined;

  if (collectionKey && typeof index === "number") {
    const n = index + 1;
    if (nested === "imageAltText")
      return t("workspace.surveys.edit.missing_label.choice_image_alt_text", { n });
    return t(collectionKey, { n });
  }

  return getNamedFieldLabel(String(collection), t);
};

const getLanguageList = (params: Record<string, unknown>, locale: string): string => {
  const codes = Array.isArray(params.invalidLanguageCodes) ? params.invalidLanguageCodes : [];

  return codes
    .filter((code): code is string => typeof code === "string" && code !== "default")
    .map((code) => getLanguageLabel(code, locale) ?? code)
    .join(", ");
};

type TSentence = "in_question" | "on_welcome_card" | "on_ending_card";

// Literal keys for the scanner: each sentence with and without its language list.
const renderSentence = (
  sentence: TSentence,
  values: Record<string, string | number>,
  languages: string,
  t: TFunction
): string => {
  const withLanguages = { ...values, languages };
  switch (sentence) {
    case "in_question":
      return languages
        ? t("workspace.surveys.edit.missing_label.in_question_for_languages", withLanguages)
        : t("workspace.surveys.edit.missing_label.in_question", values);
    case "on_welcome_card":
      return languages
        ? t("workspace.surveys.edit.missing_label.on_welcome_card_for_languages", withLanguages)
        : t("workspace.surveys.edit.missing_label.on_welcome_card", values);
    case "on_ending_card":
      return languages
        ? t("workspace.surveys.edit.missing_label.on_ending_card_for_languages", withLanguages)
        : t("workspace.surveys.edit.missing_label.on_ending_card", values);
  }
};

/** Which sentence the path calls for, and what fills it besides the languages. */
const locateLabel = (
  path: PropertyKey[],
  t: TFunction
): { sentence: TSentence; values: Record<string, string | number> } | null => {
  const [root, first, second, third, ...rest] = path;

  if (root === "welcomeCard") {
    return { sentence: "on_welcome_card", values: { field: getFieldLabel([first], t) } };
  }

  if (root === "endings" && typeof first === "number") {
    return {
      sentence: "on_ending_card",
      values: { field: getFieldLabel([second], t), endingNumber: first + 1 },
    };
  }

  if (root === "blocks" && typeof first === "number" && second === "elements" && typeof third === "number") {
    return {
      sentence: "in_question",
      values: { field: getFieldLabel(rest, t), questionNumber: third + 1, blockNumber: first + 1 },
    };
  }

  return null;
};

/**
 * The toast for a label the survey schema found missing, in the editor's language.
 *
 * The schema's own message is English, built for API callers, so the sentence is rebuilt here from the
 * issue's path and params. Returns null for any other issue, and for the legacy questions model, which
 * the block editor never produces.
 */
export const describeMissingLabelIssue = (
  issue: TLabelIssue,
  t: TFunction,
  locale: string
): TMissingLabelMessage | null => {
  if (issue.params?.missingLabel !== true) return null;

  const located = locateLabel(issue.path, t);
  if (!located) return null;

  const languages = getLanguageList(issue.params, locale);
  return {
    message: renderSentence(located.sentence, located.values, languages, t),
    hasLanguageList: languages.length > 0,
  };
};
