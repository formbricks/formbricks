import {
  type TMatchableSurveyLanguage,
  matchSurveyLanguage,
} from "@formbricks/i18n-utils/survey-language-match";
import type { TCreativeEditorForm, TCreativeLanguagesForm, TCreativeTranslation } from "./editor-form";

/**
 * What the Language tab does to a creative's languages (ENG-4003), and the warning it shows when the
 * Destination survey lacks one of them. Texts are keyed by real language codes, so a language is a code
 * plus its translation, and changing the default only swaps which texts every other language falls
 * back to.
 */

/** The part of the editor form this module reads: the texts, in every language. */
type TTextsForm = Pick<TCreativeEditorForm, "content" | "languages">;

export const EMPTY_TRANSLATION: TCreativeTranslation = {
  label: "",
  message: [],
  buttonLabel: "",
  accessibleName: "",
};

/** Adds a visible, untranslated language; the default or a language already there is left alone. */
export const addCreativeLanguage = (
  languages: TCreativeLanguagesForm,
  code: string
): TCreativeLanguagesForm =>
  code === languages.defaultLanguage || languages.others.some((language) => language.code === code)
    ? languages
    : {
        ...languages,
        others: [...languages.others, { code, enabled: true }],
        texts: { ...languages.texts, [code]: languages.texts[code] ?? EMPTY_TRANSLATION },
      };

/** Removes a language with its translation. */
export const removeCreativeLanguage = (
  languages: TCreativeLanguagesForm,
  code: string
): TCreativeLanguagesForm => {
  const { [code]: _removed, ...texts } = languages.texts;
  return { ...languages, others: languages.others.filter((language) => language.code !== code), texts };
};

/** Shows or hides a language from visitors; a hidden one keeps its translation. */
export const setCreativeLanguageEnabled = (
  languages: TCreativeLanguagesForm,
  code: string,
  enabled: boolean
): TCreativeLanguagesForm => ({
  ...languages,
  others: languages.others.map((language) => (language.code === code ? { code, enabled } : language)),
});

export const updateTranslation = (
  languages: TCreativeLanguagesForm,
  code: string,
  patch: Partial<TCreativeTranslation>
): TCreativeLanguagesForm => ({
  ...languages,
  texts: { ...languages.texts, [code]: { ...(languages.texts[code] ?? EMPTY_TRANSLATION), ...patch } },
});

/** The default language's texts, as the Content tab holds them. */
const toDefaultTranslation = (content: TCreativeEditorForm["content"]): TCreativeTranslation =>
  content.type === "feedbackButton"
    ? { ...EMPTY_TRANSLATION, label: content.label }
    : {
        ...EMPTY_TRANSLATION,
        message: content.message,
        buttonLabel: content.buttonLabel,
        accessibleName: content.accessibleName,
      };

/**
 * Makes `code` the language every other one falls back to: its translation becomes what the Content
 * tab edits, and the old default stays on as a visible language with its texts, in `code`'s place.
 */
export const makeDefaultLanguage = <TForm extends TTextsForm>(form: TForm, code: string): TForm => {
  const { content, languages } = form;
  if (code === languages.defaultLanguage || !languages.others.some((language) => language.code === code)) {
    return form;
  }
  const promoted = languages.texts[code] ?? EMPTY_TRANSLATION;
  const { [code]: _promoted, ...texts } = languages.texts;

  return {
    ...form,
    content:
      content.type === "feedbackButton"
        ? { ...content, label: promoted.label }
        : {
            ...content,
            message: promoted.message,
            buttonLabel: promoted.buttonLabel,
            accessibleName: promoted.accessibleName,
          },
    languages: {
      defaultLanguage: code,
      others: languages.others.map((language) =>
        language.code === code ? { code: languages.defaultLanguage, enabled: true } : language
      ),
      texts: { ...texts, [languages.defaultLanguage]: toDefaultTranslation(content) },
    },
  };
};

export type TTranslatableField = keyof TCreativeTranslation;

/**
 * The texts a creative has to translate: a feedback button's label; a banner's message, its button
 * label while it has a button, and its Accessible name while the default language has one (otherwise
 * visitors hear "Site notice", already in their language).
 */
export const getTranslatableFields = (content: TCreativeEditorForm["content"]): TTranslatableField[] => {
  if (content.type === "feedbackButton") return ["label"];
  return [
    "message",
    ...(content.hasButton ? (["buttonLabel"] as const) : []),
    ...(content.accessibleName.trim() ? (["accessibleName"] as const) : []),
  ];
};

const isTranslated = (translation: TCreativeTranslation, field: TTranslatableField): boolean =>
  field === "message"
    ? translation.message.some((run) => run.text.trim() !== "")
    : translation[field].trim() !== "";

/** How many of the creative's texts a language has; the rest show visitors the default's. */
export const getTranslationProgress = (
  { content, languages }: TTextsForm,
  code: string
): { translated: number; total: number } => {
  const fields = getTranslatableFields(content);
  const translation = languages.texts[code] ?? EMPTY_TRANSLATION;
  return {
    translated: fields.filter((field) => isTranslated(translation, field)).length,
    total: fields.length,
  };
};

/** The Destination survey's type and languages, as the editor knows them. */
export type TLanguageCheckSurvey = {
  type: "app" | "link";
  languages: TMatchableSurveyLanguage[];
};

/**
 * The creative's languages (the default and the visible ones) that its Destination survey can't open
 * in, matched as the SDK and the link page match a visitor's language, and what that does:
 * - `hidden`: an app survey in several languages is skipped for a visitor whose site language it lacks,
 *   so the creative is hidden for them too (ADR 0011);
 * - `defaultLanguage`: a link survey, or an app survey in one language, opens in its default language.
 * `null` when nothing is missing, or the survey was never translated, so its language is unknown.
 */
export const getLanguagesMissingFromSurvey = (
  { defaultLanguage, others }: TCreativeLanguagesForm,
  survey: TLanguageCheckSurvey | null
): { codes: string[]; effect: "hidden" | "defaultLanguage" } | null => {
  if (!survey || survey.languages.length === 0) return null;
  const codes = [defaultLanguage, ...others.filter(({ enabled }) => enabled).map(({ code }) => code)].filter(
    (code) => matchSurveyLanguage(survey.languages, code) === null
  );
  if (codes.length === 0) return null;
  return {
    codes,
    effect: survey.type === "app" && survey.languages.length > 1 ? "hidden" : "defaultLanguage",
  };
};
