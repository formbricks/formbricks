import { type TFunction } from "i18next";
import { TSurvey, TSurveyLanguage } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import {
  type TSurveyText,
  type TSurveyTextOwner,
  getSurveyTextFieldLabel,
  hasDefaultText,
  walkSurveyTexts,
} from "@/modules/survey/lib/survey-texts";
import type { TranslatableString, TranslationProgress } from "./types";

const DISPLAY_ID_WELCOME_CARD = "W";

/** The short position the Manage translations modal shows: "W", "2" (a block), "2.1" (an element), "E1". */
const getDisplayId = (owner: TSurveyTextOwner): string => {
  switch (owner.kind) {
    case "welcomeCard":
      return DISPLAY_ID_WELCOME_CARD;
    case "block":
      return `${owner.blockIndex + 1}`;
    case "element":
      return `${owner.blockIndex + 1}.${owner.elementIndex + 1}`;
    case "ending":
      return `E${owner.endingIndex + 1}`;
  }
};

const getOwnerId = (owner: TSurveyTextOwner): string => {
  switch (owner.kind) {
    case "welcomeCard":
      return "start";
    case "block":
      return owner.blockId;
    case "element":
      return owner.element.id;
    case "ending":
      return owner.endingId;
  }
};

const isOtherOptionPlaceholder = (text: TSurveyText): boolean =>
  text.field.kind === "property" && text.field.property === "otherOptionPlaceholder";

/**
 * The texts the Manage translations modal lists: every text of {@link walkSurveyTexts} with a default to
 * translate. An "Other" placeholder is always listed, falling back to the default respondents see when
 * none is stored, so it can be translated before anyone sets one.
 */
export const extractTranslatableStrings = (survey: TSurvey, t: TFunction): TranslatableString[] =>
  walkSurveyTexts(survey).flatMap((text) => {
    let value = text.value;
    if (isOtherOptionPlaceholder(text)) {
      value = {
        ...value,
        default: value?.default?.trim() ? value.default : t("workspace.surveys.edit.please_specify"),
      };
    } else if (!value || !hasDefaultText(text)) {
      return [];
    }

    return [
      {
        path: text.path,
        displayId: getDisplayId(text.owner),
        fieldLabel: getSurveyTextFieldLabel(text.field, t),
        value,
        isRichText: text.isRichText,
        elementId: getOwnerId(text.owner),
      },
    ];
  });

export const computeTranslationProgress = (
  strings: TranslatableString[],
  languageCode: string
): TranslationProgress => {
  const total = strings.length;
  if (total === 0) return { translated: 0, total: 0, percentage: 100 };
  const translated = strings.filter((s) => {
    const val = s.value[languageCode];
    if (val === undefined || val === "") return false;
    const text = s.isRichText ? getTextContent(val) : val;
    return text.trim() !== "";
  }).length;
  const percentage = Math.round((translated / total) * 100);
  return { translated, total, percentage };
};

export const getProgressColor = (percentage: number): string => {
  if (percentage < 10) return "bg-red-500";
  if (percentage < 25) return "bg-orange-700";
  if (percentage <= 45) return "bg-orange-500";
  if (percentage <= 75) return "bg-green-400";
  return "bg-green-600";
};

export const getProgressTextColor = (percentage: number): string => {
  if (percentage < 10) return "text-red-600";
  if (percentage < 25) return "text-orange-700";
  if (percentage <= 45) return "text-orange-500";
  if (percentage <= 75) return "text-green-500";
  return "text-green-600";
};

export const removeLanguageKeysFromSurvey = (survey: TSurvey, languageCode: string): TSurvey => {
  const clone = structuredClone(survey);

  function processObject(obj: unknown) {
    if (Array.isArray(obj)) {
      obj.forEach(processObject);
    } else if (obj && typeof obj === "object") {
      const record = obj as Record<string, unknown>;
      for (const key in record) {
        if (record.hasOwnProperty(key)) {
          if (key === "default" && typeof record[key] === "string") {
            delete record[languageCode];
            return;
          } else {
            processObject(record[key]);
          }
        }
      }
    }
  }

  processObject(clone);
  return clone;
};

/**
 * Strips every translation from the survey's i18n strings, keeping only their "default" value —
 * including keys of languages no longer on the survey. The `languages` list itself is left untouched;
 * callers decide what it becomes.
 */
export const removeAllTranslations = (survey: TSurvey): TSurvey => {
  const { languages, metadata, ...content } = survey;
  const clone = structuredClone(content);
  const metadataClone = structuredClone(metadata);

  const stripTranslations = (value: unknown) => {
    if (Array.isArray(value)) {
      value.forEach(stripTranslations);
    } else if (value && typeof value === "object") {
      const record = value as Record<string, unknown>;
      if (typeof record.default === "string") {
        for (const key of Object.keys(record)) {
          if (key !== "default" && typeof record[key] === "string") delete record[key];
        }
        return;
      }
      Object.values(record).forEach(stripTranslations);
    }
  };

  stripTranslations(clone);
  // metadata accepts arbitrary extra keys; only its declared i18n fields are translations.
  if (metadataClone) {
    stripTranslations(metadataClone.title);
    stripTranslations(metadataClone.description);
  }
  return { ...clone, metadata: metadataClone, languages } as TSurvey;
};

/**
 * Removes all translations and makes `language` the survey's only (and default) language. The
 * promoted language's own code keys go too: the default is always keyed as "default", so a leftover
 * code key next to it is the stale state that breaks the response API (ENG-2001).
 */
export const makeLanguageSoleDefault = (survey: TSurvey, language: TSurveyLanguage["language"]): TSurvey => ({
  ...removeAllTranslations(survey),
  languages: [{ language, default: true, enabled: true }],
});

type Traversable = Record<string, unknown> | unknown[];

const isTraversable = (val: unknown): val is Traversable => val !== null && typeof val === "object";

/**
 * Mutates the given survey in-place, setting a translation value at the
 * specified path. Use this inside a loop after cloning once upfront.
 */
export const setTranslationAtPathMutable = (
  survey: TSurvey,
  path: string,
  languageCode: string,
  value: string,
  defaultValue?: string
): void => {
  const parts = path.split(".");
  if (parts.length === 0) return;

  let current: Traversable = survey;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next: unknown = Array.isArray(current) ? current[Number(part)] : current[part];
    if (!isTraversable(next)) return;
    current = next;
  }

  const lastPart = parts.at(-1);
  if (!lastPart || Array.isArray(current)) return;

  const target = current[lastPart];
  if (isTraversable(target) && !Array.isArray(target) && "default" in target) {
    (target as Record<string, string>)[languageCode] = value;
    return;
  }

  if (target === undefined && defaultValue !== undefined && value.trim() !== "") {
    current[lastPart] = { default: defaultValue, [languageCode]: value };
  }
};
