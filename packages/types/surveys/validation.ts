import { parse } from "node-html-parser";
import { type z } from "zod";
import type { TI18nString } from "../i18n";
import { RESERVED_FIELD_NAMES } from "../reserved-field-names";
import { isLegacyIdCharset, isSafeIdentifier } from "../safe-identifier";
import type { TConditionGroup, TSingleCondition } from "./logic";
import type {
  TActionJumpToQuestion,
  TSurveyLanguage,
  TSurveyLogicAction,
  TSurveyQuestion,
  TSurveyQuestionId,
} from "./types";

/**
 * Checks if a string contains valid HTML markup
 * @param str - The input string to test
 * @returns true if the string contains valid HTML elements, false otherwise
 */
export const isValidHTML = (str: string): boolean => {
  if (!str) return false;

  try {
    const root = parse(str);
    // Check if there are any element nodes (not just text nodes)
    // nodeType 1 = ELEMENT_NODE
    return root.childNodes.some((node) => Number(node.nodeType) === 1);
  } catch {
    return false;
  }
};

/**
 * Extracts text content from an HTML string
 * Works in both browser and Node.js using node-html-parser
 * @param str - The input string (can be HTML or plain text)
 * @returns The extracted text content without HTML tags
 */
export const getTextContent = (str: string): string => {
  if (!str || str.trim() === "") return "";

  if (isValidHTML(str)) {
    try {
      const root = parse(str);
      const textContent = root.textContent;
      return textContent.trim();
    } catch {
      // If parsing fails, treat as plain text
      return str.trim();
    }
  }

  return str.trim();
};

export const FORBIDDEN_IDS = [
  "userId",
  "source",
  "suid",
  "end",
  "start",
  "welcomeCard",
  "hidden",
  "verifiedEmail",
  "multiLanguage",
  "embed",
  "verify",
];

/**
 * Link-survey params that drive the runtime rather than carrying response data, and which
 * `FORBIDDEN_IDS` does not already cover. Lowercase because they are only ever compared against a
 * lowercased key. `suToken` in particular is a credential, and the rest would silently capture UI state.
 */
export const LINK_SURVEY_SYSTEM_PARAMS = [
  "sutoken",
  "lang",
  "preview",
  "startat",
  "skipprefilled",
  "offlinesupport",
];

/**
 * Every name a declared field must never take, lowercased. The single source of truth shared by the
 * two ends that have to agree: `validateId` refuses to create such a name, and
 * `getHiddenFieldsFromSearchParams` refuses to capture a param with such a key. When the two lists
 * disagree the editor happily accepts a field that can never receive a value.
 */
export const RESERVED_DECLARED_FIELD_NAMES = new Set([
  ...FORBIDDEN_IDS.map((forbiddenId) => forbiddenId.toLowerCase()),
  ...LINK_SURVEY_SYSTEM_PARAMS,
]);

const FIELD_TO_LABEL_MAP: Record<string, string> = {
  headline: "question",
  subheader: "description",
  buttonLabel: "next button label",
  backButtonLabel: "back button label",
  placeholder: "placeholder",
  upperLabel: "upper label",
  lowerLabel: "lower label",
  "consent.label": "checkbox label",
  dismissButtonLabel: "dismiss button label",
  html: "description",
  cardHeadline: "note",
  welcomeCardHtml: "welcome message",
  endingCardButtonLabel: "button label",
};

const extractLanguageCodes = (surveyLanguages?: TSurveyLanguage[]): string[] => {
  if (!surveyLanguages) return [];
  return surveyLanguages.map((surveyLanguage) =>
    surveyLanguage.default ? "default" : surveyLanguage.language.code
  );
};

const validateLabelForAllLanguages = (label: TI18nString, surveyLanguages: TSurveyLanguage[]): string[] => {
  const enabledLanguages = surveyLanguages.filter((lang) => lang.enabled);
  const languageCodes = extractLanguageCodes(enabledLanguages);

  const languages = !languageCodes.length ? ["default"] : languageCodes;
  const invalidLanguageCodes = languages.filter((language) => {
    // Check if label exists and is not undefined
    if (!label[language]) return true;

    // Use getTextContent to extract text from HTML or plain text
    // This ensures empty HTML like <p><br></p> is properly detected as empty
    const textContent = getTextContent(label[language]);
    return textContent.length === 0;
  });

  return invalidLanguageCodes;
};

export const validateQuestionLabels = (
  field: string,
  fieldLabel: TI18nString,
  languages: TSurveyLanguage[],
  questionIndex: number,
  skipArticle = false
): z.core.$ZodRawIssue | null => {
  const invalidLanguageCodes = validateLabelForAllLanguages(fieldLabel, languages);
  const isDefaultMissing = invalidLanguageCodes.includes("default");

  const messagePrefix = skipArticle ? "" : "The ";
  const messageField = FIELD_TO_LABEL_MAP[field] ? FIELD_TO_LABEL_MAP[field] : field;
  const messageSuffix = isDefaultMissing ? " is missing" : " is missing for the following languages: ";

  const message = isDefaultMissing
    ? `${messagePrefix}${messageField} in question ${String(questionIndex + 1)}${messageSuffix}`
    : `${messagePrefix}${messageField} in question ${String(questionIndex + 1)}${messageSuffix} -fLang- ${invalidLanguageCodes.join()}`;

  if (isDefaultMissing) {
    return {
      code: "custom",
      input: fieldLabel,
      message,
      path: ["questions", questionIndex, field],
    };
  }

  // fieldLabel should contain all the keys present in languages
  // even if one of the keys is an empty string, its okay but it shouldn't be undefined

  for (const language of languages) {
    if (
      !language.default &&
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- could be undefined
      fieldLabel[language.language.code] === undefined
    ) {
      return {
        code: "custom",
        input: fieldLabel,
        message: `The ${field} in question ${String(questionIndex + 1)} is not present for the following languages: ${language.language.code}`,
        path: ["questions", questionIndex, field],
      };
    }
  }

  if (invalidLanguageCodes.length) {
    return {
      code: "custom",
      input: fieldLabel,
      message,
      path: ["questions", questionIndex, field],
      params: { invalidLanguageCodes },
    };
  }

  return null;
};

export const validateCardFieldsForAllLanguages = (
  field: string,
  fieldLabel: TI18nString,
  languages: TSurveyLanguage[],
  cardType: "welcome" | "end",
  endingCardIndex?: number,
  skipArticle = false
): z.core.$ZodRawIssue | null => {
  const cardTypeLabel =
    cardType === "welcome" ? "Welcome card" : `Ending card ${((endingCardIndex ?? -1) + 1).toString()}`; // Ensure 1-based indexing

  const path = cardType === "welcome" ? ["welcomeCard", field] : ["endings", endingCardIndex ?? -1, field];

  const invalidLanguageCodes = validateLabelForAllLanguages(fieldLabel, languages);
  const isDefaultMissing = invalidLanguageCodes.includes("default");

  const messagePrefix = skipArticle ? "" : "The ";
  const messageField = FIELD_TO_LABEL_MAP[field] ? FIELD_TO_LABEL_MAP[field] : field;
  const messageSuffix = isDefaultMissing ? " is missing" : " is missing for the following languages: ";

  const message = isDefaultMissing
    ? `${messagePrefix}${messageField} on the ${cardTypeLabel}${messageSuffix}`
    : `${messagePrefix}${messageField} on the ${cardTypeLabel}${messageSuffix} -fLang- ${invalidLanguageCodes.join(", ")}`;

  if (isDefaultMissing) {
    return {
      code: "custom",
      input: fieldLabel,
      message,
      path,
    };
  }

  // fieldLabel should contain all the keys present in languages
  // even if one of the keys is an empty string, its okay but it shouldn't be undefined

  for (const language of languages) {
    if (
      !language.default &&
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- could be undefined
      fieldLabel[language.language.code] === undefined
    ) {
      return {
        code: "custom",
        input: fieldLabel,
        message: `The ${field} in ${cardTypeLabel} is not present for the following languages: ${language.language.code}`,
        path,
      };
    }
  }

  if (invalidLanguageCodes.length) {
    return {
      code: "custom",
      input: fieldLabel,
      message,
      path,
      params: { invalidLanguageCodes },
    };
  }

  return null;
};

export const findLanguageCodesForDuplicateLabels = (
  labels: TI18nString[],
  surveyLanguages: TSurveyLanguage[]
): string[] => {
  const enabledLanguages = surveyLanguages.filter((lang) => lang.enabled);
  const languageCodes = extractLanguageCodes(enabledLanguages);

  const languagesToCheck = languageCodes.length === 0 ? ["default"] : languageCodes;

  const duplicateLabels = new Set<string>();

  for (const language of languagesToCheck) {
    const labelTexts = labels
      .map((label) => label[language])
      .filter((text): text is string => typeof text === "string" && text.trim().length > 0)
      .map((text) => text.trim());
    const uniqueLabels = new Set(labelTexts);

    if (uniqueLabels.size !== labelTexts.length) {
      duplicateLabels.add(language);
    }
  }

  return Array.from(duplicateLabels);
};

export const findQuestionsWithCyclicLogic = (questions: TSurveyQuestion[]): string[] => {
  const visited: Record<string, boolean> = {};
  const recStack: Record<string, boolean> = {};
  const cyclicQuestions = new Set<string>();

  const checkForCyclicLogic = (questionId: TSurveyQuestionId): boolean => {
    if (!visited[questionId]) {
      visited[questionId] = true;
      recStack[questionId] = true;

      const question = questions.find((ques) => ques.id === questionId);
      if (question?.logic && question.logic.length > 0) {
        for (const logic of question.logic) {
          const jumpActions = findJumpToQuestionActions(logic.actions);
          for (const jumpAction of jumpActions) {
            const destination = jumpAction.target;
            if (!visited[destination] && checkForCyclicLogic(destination)) {
              cyclicQuestions.add(questionId);
              return true;
            } else if (recStack[destination]) {
              cyclicQuestions.add(questionId);
              return true;
            }
          }
        }
      }

      // Check fallback logic
      if (question?.logicFallback) {
        const fallbackQuestionId = question.logicFallback;
        if (!visited[fallbackQuestionId] && checkForCyclicLogic(fallbackQuestionId)) {
          cyclicQuestions.add(questionId);
          return true;
        } else if (recStack[fallbackQuestionId]) {
          cyclicQuestions.add(questionId);
          return true;
        }
      }

      // Handle default behavior: move to the next question if no jump actions or fallback logic is defined
      const nextQuestionIndex = questions.findIndex((ques) => ques.id === questionId) + 1;
      const nextQuestion = questions[nextQuestionIndex] as TSurveyQuestion | undefined;
      if (nextQuestion && !visited[nextQuestion.id] && checkForCyclicLogic(nextQuestion.id)) {
        return true;
      }
    }

    recStack[questionId] = false;
    return false;
  };

  for (const question of questions) {
    checkForCyclicLogic(question.id);
  }

  return Array.from(cyclicQuestions);
};

// Helper function to find all "jumpToQuestion" actions in the logic
const findJumpToQuestionActions = (actions: TSurveyLogicAction[]): TActionJumpToQuestion[] => {
  return actions.filter((action): action is TActionJumpToQuestion => action.objective === "jumpToQuestion");
};

export enum TValidateIdErrorCode {
  Empty = "empty",
  Duplicate = "duplicate",
  Reserved = "reserved",
  HasSpaces = "has_spaces",
  InvalidChars = "invalid_chars",
  NotSafeIdentifier = "not_safe_identifier",
}

export interface TValidateIdError {
  code: TValidateIdErrorCode;
  field: string;
}

/**
 * Which naming rules apply to the name being validated.
 *
 * A named rule rather than a `requireSafeIdentifier` boolean because that flag bundled **three**
 * decisions — refuse names that can never be filled, refuse Tier-1 catalog names, apply
 * `isSafeIdentifier` — and ENG-2539 decided the editor and the management API want different
 * answers. A boolean cannot express "two of the three", and the next person to tidy it back into one
 * rule would silently re-break a documented API contract.
 *
 * - `legacyId` — element, question and ending-card ids. Case-*sensitive* `FORBIDDEN_IDS`, so renaming
 *   a question to `Q1` keeps working exactly as it always has.
 * - `declaredFieldStrict` — a field name a **human authors in the editor**, where the error is shown
 *   inline and translated and picking another name costs nothing. All three rules.
 * - `declaredFieldPortable` — a field name arriving through the **management API**. Refuses only
 *   names that could never receive a value; see {@link validateId} for why the other two are off.
 */
export type TValidateIdRule = "legacyId" | "declaredFieldStrict" | "declaredFieldPortable";

export interface TValidateIdOptions {
  /** Defaults to `legacyId`, which is what element and question id renames have always used. */
  rule?: TValidateIdRule;
}

/**
 * Validates one id or declared field name against the rules its `rule` selects.
 *
 * **Why the API and the editor deliberately disagree (ENG-2539).** ENG-1839's guard moved the
 * declared-field naming boundary from the editor to the write path, and `requireSafeIdentifier` took
 * three rules along with it. The management API had previously applied *none* of them — it validated
 * names only through `ZSurveyHiddenFields`, whose own comment says it is "lenient on purpose". That
 * landed inside ENG-1838, whose whole purpose is that API consumers notice nothing, and it broke a
 * real pattern: automation re-creating surveys from a stored JSON export stopped on a 400. The three
 * rules were judged separately:
 *
 * 1. **`RESERVED_DECLARED_FIELD_NAMES`** (`lang`, `verify`, `startat`, `userId`, `suToken`, …) —
 *    **kept everywhere.** `getHiddenFieldsFromSearchParams` refuses these params, so a field declared
 *    under one could never receive a value. Refusing at create is a favour to the caller.
 * 2. **`RESERVED_FIELD_NAMES`** (the Tier-1 catalog: `url`, `country`, `language`, `timezone`, …) —
 *    **editor only.** These params *are* captured. Such a field works and is grandfathered, exactly
 *    like the 95 production surveys already declaring `url`. Refusing is hygiene, not correctness,
 *    and hygiene does not outweigh a documented API contract. The residual cost of letting the
 *    collision set grow is *feature availability, not correctness*: a future Tier-2 field is shadowed
 *    in surveys that already declare that name, so those surveys keep their own meaning and simply do
 *    not gain the new auto-captured field — which is right behaviour. That only became true once
 *    ENG-2538 made shadowing apply at **read** time; before it, grandfathering covered authoring and
 *    the picker but not reading, and every new collision would have inherited that leak.
 * 3. **`isSafeIdentifier`** — **editor only.** Collateral from the bundling: it refused `UserRegion`,
 *    `user-region`, `_internal`, `1st_visit`. Nothing to do with Embedded Data, and
 *    `docs/api-v3-reference/.../SurveyHiddenFields.yml` publishes the *lenient* legacy charset
 *    (`^[a-zA-Z0-9_-]+$`), so the API was contradicting its own reference.
 *
 * The editor keeps all three because a human sees the error inline and translated and picking another
 * name costs nothing. That asymmetry is the decision, not an oversight — `validation.test.ts` pins it.
 */
export const validateId = (
  field: string,
  existingElementIds: string[],
  existingEndingCardIds: string[],
  existingHiddenFieldIds: string[],
  existingVariableNames: string[] = [],
  { rule = "legacyId" }: TValidateIdOptions = {}
): TValidateIdError | null => {
  if (field.trim() === "") {
    return { code: TValidateIdErrorCode.Empty, field };
  }

  const combinedIds = [
    ...existingElementIds,
    ...existingHiddenFieldIds,
    ...existingEndingCardIds,
    ...existingVariableNames,
  ];

  if (combinedIds.findIndex((id) => id.toLowerCase() === field.toLowerCase()) !== -1) {
    return { code: TValidateIdErrorCode.Duplicate, field };
  }

  // Reserved names stay case-sensitive on `legacyId` so element and question id renames keep
  // behaving exactly as before. Both declared-field rules match case-insensitively and against the
  // link-survey system params too, because `getHiddenFieldsFromSearchParams` refuses to capture any
  // of those under any casing - a name that could never receive a value must not be creatable.
  //
  // `RESERVED_FIELD_NAMES` (the Tier-1 Embedded Data catalog: country, url, browser, ...) joins them
  // on `declaredFieldStrict` ONLY - see the note below on why the API does not apply it. It must
  // never move into `RESERVED_DECLARED_FIELD_NAMES`, which is also the capture-refusal list read by
  // `getHiddenFieldsFromSearchParams` — putting `country` there would stop `?country=DE` from
  // filling the hidden field of a survey that legitimately declares `country` today. Refused at
  // authoring time; whatever a survey already declares keeps working.
  const isUnfillable = RESERVED_DECLARED_FIELD_NAMES.has(field.toLowerCase());
  const isReserved =
    rule === "legacyId"
      ? FORBIDDEN_IDS.includes(field)
      : isUnfillable || (rule === "declaredFieldStrict" && RESERVED_FIELD_NAMES.has(field.toLowerCase()));

  if (isReserved) {
    return { code: TValidateIdErrorCode.Reserved, field };
  }

  if (field.includes(" ")) {
    return { code: TValidateIdErrorCode.HasSpaces, field };
  }

  if (!isLegacyIdCharset(field)) {
    return { code: TValidateIdErrorCode.InvalidChars, field };
  }

  if (rule === "declaredFieldStrict" && !isSafeIdentifier(field)) {
    return { code: TValidateIdErrorCode.NotSafeIdentifier, field };
  }

  return null;
};

type TCondition = TSingleCondition | TConditionGroup;

export const isSingleCondition = (condition: TCondition): condition is TSingleCondition => {
  return "leftOperand" in condition && "operator" in condition;
};

export const isConditionGroup = (condition: TCondition): condition is TConditionGroup => {
  return "conditions" in condition;
};
