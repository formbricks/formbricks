import { TI18nString } from "@formbricks/types/i18n";
import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { TSurvey } from "@formbricks/types/surveys/types";
import { getTextContent } from "@formbricks/types/surveys/validation";
import { isI18nObject } from "@/lib/i18n/utils";
import { type DeduplicatedString, type TranslatableString, type TranslationProgress } from "./types";

const RICH_TEXT_FIELDS = new Set(["headline", "subheader", "html"]);

const pushIfI18n = (
  result: TranslatableString[],
  obj: unknown,
  field: string,
  path: string,
  displayId: string,
  fieldLabel: string,
  elementId: string
) => {
  const val = (obj as Record<string, unknown>)?.[field];
  if (val && isI18nObject(val)) {
    const defaultText = val.default ?? "";
    const isRichText = RICH_TEXT_FIELDS.has(field);
    const hasContent = isRichText ? getTextContent(defaultText).trim() !== "" : defaultText.trim() !== "";
    if (!hasContent) return;

    result.push({
      path: `${path}.${field}`,
      displayId,
      fieldLabel,
      value: val,
      isRichText,
      elementId,
    });
  }
};

export const extractTranslatableStrings = (survey: TSurvey): TranslatableString[] => {
  const result: TranslatableString[] = [];

  // Welcome card
  if (survey.welcomeCard.enabled) {
    const wc = survey.welcomeCard;
    const base = "welcomeCard";
    const did = "W";
    const eid = "start";
    pushIfI18n(result, wc, "headline", base, did, "Headline", eid);
    pushIfI18n(result, wc, "subheader", base, did, "Subheader", eid);
    pushIfI18n(result, wc, "buttonLabel", base, did, "Button Label", eid);
  }

  // Blocks → elements
  survey.blocks.forEach((block, blockIdx) => {
    // Block-level fields
    pushIfI18n(
      result,
      block,
      "buttonLabel",
      `blocks.${blockIdx}`,
      `${blockIdx + 1}`,
      "Button Label",
      block.id
    );
    pushIfI18n(
      result,
      block,
      "backButtonLabel",
      `blocks.${blockIdx}`,
      `${blockIdx + 1}`,
      "Back Button Label",
      block.id
    );

    block.elements.forEach((element, elementIdx) => {
      const base = `blocks.${blockIdx}.elements.${elementIdx}`;
      const did = `${blockIdx + 1}.${elementIdx + 1}`;
      const eid = element.id;

      // Common fields
      pushIfI18n(result, element, "headline", base, did, "Headline", eid);
      pushIfI18n(result, element, "subheader", base, did, "Subheader", eid);

      // Type-specific fields
      switch (element.type) {
        case TSurveyElementTypeEnum.OpenText:
          pushIfI18n(result, element, "placeholder", base, did, "Placeholder", eid);
          break;
        case TSurveyElementTypeEnum.Consent:
          pushIfI18n(result, element, "label", base, did, "Label", eid);
          break;
        case TSurveyElementTypeEnum.MultipleChoiceSingle:
        case TSurveyElementTypeEnum.MultipleChoiceMulti: {
          const el = element as {
            choices?: Array<{ label: TI18nString }>;
            otherOptionPlaceholder?: TI18nString;
          };
          el.choices?.forEach((choice, ci) => {
            if (isI18nObject(choice.label) && (choice.label.default ?? "").trim()) {
              result.push({
                path: `${base}.choices.${ci}.label`,
                displayId: did,
                fieldLabel: `Choice ${ci + 1}`,
                value: choice.label,
                isRichText: false,
                elementId: eid,
              });
            }
          });
          pushIfI18n(result, element, "otherOptionPlaceholder", base, did, "Other Placeholder", eid);
          break;
        }
        case TSurveyElementTypeEnum.NPS:
        case TSurveyElementTypeEnum.Rating:
          pushIfI18n(result, element, "lowerLabel", base, did, "Lower Label", eid);
          pushIfI18n(result, element, "upperLabel", base, did, "Upper Label", eid);
          break;
        case TSurveyElementTypeEnum.CTA:
          pushIfI18n(result, element, "ctaButtonLabel", base, did, "CTA Button Label", eid);
          break;
        case TSurveyElementTypeEnum.Date:
          pushIfI18n(result, element, "html", base, did, "HTML", eid);
          break;
        case TSurveyElementTypeEnum.Matrix: {
          const matEl = element as {
            rows?: Array<{ label: TI18nString }>;
            columns?: Array<{ label: TI18nString }>;
          };
          matEl.rows?.forEach((row, ri) => {
            if (isI18nObject(row.label) && (row.label.default ?? "").trim()) {
              result.push({
                path: `${base}.rows.${ri}.label`,
                displayId: did,
                fieldLabel: `Row ${ri + 1}`,
                value: row.label,
                isRichText: false,
                elementId: eid,
              });
            }
          });
          matEl.columns?.forEach((col, ci) => {
            if (isI18nObject(col.label) && (col.label.default ?? "").trim()) {
              result.push({
                path: `${base}.columns.${ci}.label`,
                displayId: did,
                fieldLabel: `Column ${ci + 1}`,
                value: col.label,
                isRichText: false,
                elementId: eid,
              });
            }
          });
          break;
        }
        case TSurveyElementTypeEnum.Address: {
          const addrFields = ["addressLine1", "addressLine2", "city", "state", "zip", "country"] as const;
          addrFields.forEach((f) => {
            const sub = (element as unknown as Record<string, { placeholder?: TI18nString }>)[f];
            if (sub?.placeholder && isI18nObject(sub.placeholder) && (sub.placeholder.default ?? "").trim()) {
              result.push({
                path: `${base}.${f}.placeholder`,
                displayId: did,
                fieldLabel: `${f} Placeholder`,
                value: sub.placeholder,
                isRichText: false,
                elementId: eid,
              });
            }
          });
          break;
        }
        case TSurveyElementTypeEnum.ContactInfo: {
          const contactFields = ["firstName", "lastName", "email", "phone", "company"] as const;
          contactFields.forEach((f) => {
            const sub = (element as unknown as Record<string, { placeholder?: TI18nString }>)[f];
            if (sub?.placeholder && isI18nObject(sub.placeholder) && (sub.placeholder.default ?? "").trim()) {
              result.push({
                path: `${base}.${f}.placeholder`,
                displayId: did,
                fieldLabel: `${f} Placeholder`,
                value: sub.placeholder,
                isRichText: false,
                elementId: eid,
              });
            }
          });
          break;
        }
        case TSurveyElementTypeEnum.Ranking: {
          const rankEl = element as {
            choices?: Array<{ label: TI18nString }>;
            otherOptionPlaceholder?: TI18nString;
          };
          rankEl.choices?.forEach((choice, ci) => {
            if (isI18nObject(choice.label) && (choice.label.default ?? "").trim()) {
              result.push({
                path: `${base}.choices.${ci}.label`,
                displayId: did,
                fieldLabel: `Choice ${ci + 1}`,
                isRichText: false,
                value: choice.label,
                elementId: eid,
              });
            }
          });
          pushIfI18n(result, element, "otherOptionPlaceholder", base, did, "Other Placeholder", eid);
          break;
        }
      }
    });
  });

  // Endings
  survey.endings.forEach((ending, endingIdx) => {
    if (ending.type === "endScreen") {
      const base = `endings.${endingIdx}`;
      const did = `E${endingIdx + 1}`;
      const eid = ending.id;
      pushIfI18n(result, ending, "headline", base, did, "Headline", eid);
      pushIfI18n(result, ending, "subheader", base, did, "Subheader", eid);
      pushIfI18n(result, ending, "buttonLabel", base, did, "Button Label", eid);
    }
  });

  return result;
};

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

export const deduplicateStrings = (strings: TranslatableString[]): DeduplicatedString[] => {
  const map = new Map<string, DeduplicatedString>();

  for (const s of strings) {
    const key = s.value.default ?? "";
    const existing = map.get(key);
    if (existing) {
      existing.duplicatePaths.push(s.path);
    } else {
      map.set(key, {
        key: s.path,
        displayId: s.displayId,
        fieldLabel: s.fieldLabel,
        value: s.value,
        duplicatePaths: [s.path],
      });
    }
  }

  return Array.from(map.values());
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

type Traversable = Record<string, unknown> | unknown[];

const isTraversable = (val: unknown): val is Traversable => val !== null && typeof val === "object";

export const setTranslationAtPath = (
  survey: TSurvey,
  path: string,
  languageCode: string,
  value: string
): TSurvey => {
  const clone = structuredClone(survey);
  const parts = path.split(".");
  if (parts.length === 0) return survey;

  let current: Traversable = clone;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    const next: unknown = Array.isArray(current) ? current[Number(part)] : current[part];
    if (!isTraversable(next)) return survey;
    current = next;
  }

  const lastPart = parts.at(-1);
  if (!lastPart || Array.isArray(current)) return survey;

  const target = current[lastPart];
  if (isTraversable(target) && !Array.isArray(target) && "default" in target) {
    (target as Record<string, string>)[languageCode] = value;
  }

  return clone;
};
