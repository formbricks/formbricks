import type { TFunction } from "i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/utils";

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
  /** True when the message lists languages, so the caller opens the tab where they are translated. */
  opensLanguageTab: boolean;
}

const NUMBERED_COLLECTIONS = new Set(["choices", "rows", "columns"]);

// Literal t() calls rather than a key table, because the translation scanner only sees literal keys.
const getSubfieldName = (key: string, t: TFunction): string | undefined => {
  switch (key) {
    case "firstname":
      return t("workspace.surveys.edit.first_name");
    case "lastname":
      return t("workspace.surveys.edit.last_name");
    case "email":
      return t("common.email");
    case "phone":
      return t("common.phone");
    case "company":
      return t("workspace.surveys.edit.company");
    case "addressline1":
      return t("workspace.surveys.edit.address_line_1");
    case "addressline2":
      return t("workspace.surveys.edit.address_line_2");
    case "city":
      return t("workspace.surveys.edit.city");
    case "state":
      return t("workspace.surveys.edit.state");
    case "zip":
      return t("workspace.surveys.edit.zip");
    case "country":
      return t("workspace.surveys.edit.country");
    default:
      return undefined;
  }
};

const getNamedFieldLabel = (field: string, t: TFunction): string => {
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
    case "imageAltText":
      return t("workspace.surveys.edit.image_alt_text");
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

  if (typeof collection === "string" && NUMBERED_COLLECTIONS.has(collection) && typeof index === "number") {
    const n = index + 1;
    if (nested === "imageAltText")
      return t("workspace.surveys.edit.missing_label.choice_image_alt_text", { n });
    if (collection === "rows") return t("common.row_n", { n });
    if (collection === "columns") return t("common.column_n", { n });
    return t("common.choice_n", { n });
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

  const languages = getLanguageList(issue.params, locale);
  const opensLanguageTab = languages.length > 0;
  const [root, first, second, third, ...rest] = issue.path;

  if (root === "welcomeCard") {
    const field = getFieldLabel([first], t);
    return {
      message: opensLanguageTab
        ? t("workspace.surveys.edit.missing_label.on_welcome_card_for_languages", { field, languages })
        : t("workspace.surveys.edit.missing_label.on_welcome_card", { field }),
      opensLanguageTab,
    };
  }

  if (root === "endings" && typeof first === "number") {
    const field = getFieldLabel([second], t);
    const endingNumber = first + 1;
    return {
      message: opensLanguageTab
        ? t("workspace.surveys.edit.missing_label.on_ending_card_for_languages", {
            field,
            endingNumber,
            languages,
          })
        : t("workspace.surveys.edit.missing_label.on_ending_card", { field, endingNumber }),
      opensLanguageTab,
    };
  }

  if (root === "blocks" && typeof first === "number" && second === "elements" && typeof third === "number") {
    const field = getFieldLabel(rest, t);
    const questionNumber = third + 1;
    const blockNumber = first + 1;
    return {
      message: opensLanguageTab
        ? t("workspace.surveys.edit.missing_label.in_question_for_languages", {
            field,
            questionNumber,
            blockNumber,
            languages,
          })
        : t("workspace.surveys.edit.missing_label.in_question", { field, questionNumber, blockNumber }),
      opensLanguageTab,
    };
  }

  return null;
};
