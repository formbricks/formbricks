import { isRecord } from "../../shared/guards";
import { plural } from "../../shared/plural";
import { type LogicContext, describeBlockLogic, describeFallback } from "./describe-logic";
import { hasTranslation, resolveText } from "./i18n-text";
import type { JsonRecord, PreviewSettings, SurveyDocument } from "./types";

export interface OutlineQuestion {
  id: string;
  number: number;
  typeLabel: string;
  headline: string;
  description: string;
  required: boolean;
  /** Choices, scale, limits: short facts about how it is answered. */
  details: string[];
  /** The language is selected but this question has no text in it. */
  missingTranslation: boolean;
}

export interface OutlineBlock {
  id: string;
  number: number;
  name: string;
  questions: OutlineQuestion[];
  logic: string[];
  fallback: string | undefined;
}

export interface OutlineEnding {
  id: string;
  number: number;
  kind: "screen" | "redirect";
  title: string;
  detail: string;
}

export interface Outline {
  welcome: { headline: string; description: string } | null;
  blocks: OutlineBlock[];
  endings: OutlineEnding[];
  questionCount: number;
  hiddenFields: string[];
  variables: string[];
}

const TYPE_LABELS: Record<string, string> = {
  openText: "Free text",
  multipleChoiceSingle: "Single choice",
  multipleChoiceMulti: "Multiple choice",
  nps: "Net promoter score",
  cta: "Call to action",
  rating: "Rating",
  consent: "Consent",
  pictureSelection: "Picture selection",
  cal: "Booking",
  date: "Date",
  matrix: "Matrix",
  address: "Address",
  ranking: "Ranking",
  contactInfo: "Contact info",
  csat: "Satisfaction",
  ces: "Effort score",
  fileUpload: "File upload",
};

export const getTypeLabel = (type: unknown): string =>
  typeof type === "string" ? (TYPE_LABELS[type] ?? type) : "Question";

const records = (value: unknown): JsonRecord[] => (Array.isArray(value) ? value.filter(isRecord) : []);

const asString = (value: unknown): string => (typeof value === "string" ? value : "");

const joinList = (items: string[], max = 8): string =>
  items.length > max ? `${items.slice(0, max).join(", ")} and ${items.length - max} more` : items.join(", ");

interface Reader {
  text: (value: unknown) => string;
}

const describeChoices = (element: JsonRecord, reader: Reader): string[] => {
  const choices = records(element.choices).map((choice) => reader.text(choice.label) || "(no label)");
  if (choices.length === 0) return [];
  return [`${choices.length} options: ${joinList(choices)}`];
};

const describeScale = (element: JsonRecord, reader: Reader): string[] => {
  const range = typeof element.range === "number" ? element.range : undefined;
  const scale = asString(element.scale);
  const facts: string[] = [];
  if (range)
    facts.push(
      `${range}-point ${scale === "star" ? "star" : scale === "smiley" ? "smiley" : "number"} scale`
    );
  const lower = reader.text(element.lowerLabel);
  const upper = reader.text(element.upperLabel);
  if (lower || upper) facts.push(`${lower || "…"} to ${upper || "…"}`);
  return facts;
};

const describeToggles = (element: JsonRecord, keys: [string, string][]): string[] => {
  const shown = keys
    .filter(([key]) => isRecord(element[key]) && element[key].show === true)
    .map(
      ([key, label]) =>
        `${label}${isRecord(element[key]) && element[key].required === true ? " (required)" : ""}`
    );
  return shown.length > 0 ? [`Fields: ${shown.join(", ")}`] : [];
};

const describeByType = (element: JsonRecord, reader: Reader): string[] => {
  switch (element.type) {
    case "openText": {
      const facts = [`${asString(element.inputType) || "text"} input`];
      if (element.longAnswer === true) facts.push("long answer");
      const limit =
        isRecord(element.charLimit) && element.charLimit.enabled === true ? element.charLimit : null;
      if (limit) {
        const min = typeof limit.min === "number" ? `at least ${limit.min}` : "";
        const max = typeof limit.max === "number" ? `at most ${limit.max}` : "";
        facts.push(`${[min, max].filter(Boolean).join(", ")} characters`);
      }
      return [facts.join(", ")];
    }
    case "multipleChoiceSingle":
    case "multipleChoiceMulti":
    case "ranking":
      return describeChoices(element, reader);
    case "nps":
      return ["0 to 10 scale", ...describeScale({ ...element, range: undefined }, reader)];
    case "rating":
    case "csat":
    case "ces":
      return describeScale(element, reader);
    case "pictureSelection":
      return [
        `${records(element.choices).length} pictures${element.allowMulti === true ? ", several can be picked" : ""}`,
      ];
    case "matrix":
      return [
        `${records(element.rows).length} rows: ${joinList(records(element.rows).map((row) => reader.text(row.label)))}`,
        `${records(element.columns).length} columns: ${joinList(records(element.columns).map((column) => reader.text(column.label)))}`,
      ];
    case "date":
      return [`Format ${asString(element.format)}`];
    case "fileUpload": {
      const facts = [element.allowMultipleFiles === true ? "several files" : "one file"];
      if (typeof element.maxSizeInMB === "number") facts.push(`up to ${element.maxSizeInMB} MB`);
      if (Array.isArray(element.allowedFileExtensions) && element.allowedFileExtensions.length > 0) {
        facts.push(element.allowedFileExtensions.join(", "));
      }
      return [facts.join(", ")];
    }
    case "cal":
      return [`Booking page: ${asString(element.calUserName)}`];
    case "consent":
      return reader.text(element.label) ? [`Checkbox: ${reader.text(element.label)}`] : [];
    case "cta":
      return element.buttonExternal === true
        ? [`Button "${reader.text(element.ctaButtonLabel)}" opens ${asString(element.buttonUrl)}`]
        : [];
    case "address":
      return describeToggles(element, [
        ["addressLine1", "address line 1"],
        ["addressLine2", "address line 2"],
        ["city", "city"],
        ["state", "state"],
        ["zip", "zip"],
        ["country", "country"],
      ]);
    case "contactInfo":
      return describeToggles(element, [
        ["firstName", "first name"],
        ["lastName", "last name"],
        ["email", "email"],
        ["phone", "phone"],
        ["company", "company"],
      ]);
    default:
      return [];
  }
};

const describeValidation = (element: JsonRecord): string[] => {
  const validation = element.validation;
  if (!isRecord(validation) || !Array.isArray(validation.rules) || validation.rules.length === 0) return [];
  const count = validation.rules.length;
  const logic = validation.logic === "or" ? "any of" : "all of";
  return [`${plural(count, "validation rule")}${count > 1 ? ` (${logic} must pass)` : ""}`];
};

export const buildLogicContext = (survey: SurveyDocument, languageCode: string): LogicContext => {
  const context: LogicContext = {
    languageCode,
    defaultLanguage: survey.defaultLanguage,
    elements: new Map(),
    blocks: new Map(),
    endings: new Map(),
    variables: new Map(),
  };
  const reader: Reader = { text: (value) => resolveText(value, languageCode, survey.defaultLanguage) };

  let questionNumber = 0;
  survey.blocks.forEach((block, index) => {
    context.blocks.set(asString(block.id), { number: index + 1, name: asString(block.name) });
    records(block.elements).forEach((element) => {
      questionNumber += 1;
      context.elements.set(asString(element.id), {
        number: questionNumber,
        choices: new Map(
          records(element.choices).map((choice) => [asString(choice.id), reader.text(choice.label)] as const)
        ),
      });
    });
  });
  survey.endings.forEach((ending, index) => context.endings.set(asString(ending.id), index + 1));
  survey.variables.forEach((variable) =>
    context.variables.set(asString(variable.id), asString(variable.name))
  );
  return context;
};

/**
 * The survey as a reading order: welcome card, blocks with their questions and logic, endings. Text is in
 * `languageCode` where the survey has it, in its default language where it does not.
 */
export const buildOutline = (survey: SurveyDocument, languageCode: string): Outline => {
  const reader: Reader = { text: (value) => resolveText(value, languageCode, survey.defaultLanguage) };
  const context = buildLogicContext(survey, languageCode);
  const isDefault = languageCode.toLowerCase() === survey.defaultLanguage.toLowerCase();

  let questionNumber = 0;
  const blocks = survey.blocks.map<OutlineBlock>((block, index) => ({
    id: asString(block.id),
    number: index + 1,
    name: asString(block.name),
    questions: records(block.elements).map<OutlineQuestion>((element) => {
      questionNumber += 1;
      return {
        id: asString(element.id),
        number: questionNumber,
        typeLabel: getTypeLabel(element.type),
        headline: reader.text(element.headline),
        description: reader.text(element.subheader),
        required: element.required === true,
        details: [...describeByType(element, reader), ...describeValidation(element)],
        missingTranslation: !isDefault && !hasTranslation(element.headline, languageCode),
      };
    }),
    logic: describeBlockLogic(block.logic, context),
    fallback: describeFallback(block.logicFallback, context),
  }));

  const endings = survey.endings.map<OutlineEnding>((ending, index) =>
    ending.type === "redirectToUrl"
      ? {
          id: asString(ending.id),
          number: index + 1,
          kind: "redirect",
          title: asString(ending.label) || "Redirect",
          detail: `Sends the respondent to ${asString(ending.url)}`,
        }
      : {
          id: asString(ending.id),
          number: index + 1,
          kind: "screen",
          title: reader.text(ending.headline),
          detail: reader.text(ending.subheader),
        }
  );

  const welcome =
    survey.welcomeCard?.enabled === true
      ? {
          headline: reader.text(survey.welcomeCard.headline),
          description: reader.text(survey.welcomeCard.subheader),
        }
      : null;

  const hiddenFieldIds = survey.hiddenFields?.enabled === true ? survey.hiddenFields.fieldIds : undefined;

  return {
    welcome,
    blocks,
    endings,
    questionCount: questionNumber,
    hiddenFields: Array.isArray(hiddenFieldIds)
      ? hiddenFieldIds.filter((id): id is string => typeof id === "string")
      : [],
    variables: survey.variables.map((variable) => asString(variable.name)).filter(Boolean),
  };
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  inProgress: "In progress",
  paused: "Paused",
  completed: "Completed",
};

export const getStatusLabel = (status: string): string => STATUS_LABELS[status] ?? status;

export const getStatusTone = (status: string): "neutral" | "success" | "warning" | "info" =>
  status === "inProgress"
    ? "success"
    : status === "paused"
      ? "warning"
      : status === "completed"
        ? "info"
        : "neutral";

export const getTypeName = (type: string): string => (type === "app" ? "App survey" : "Link survey");

export interface SettingLine {
  label: string;
  value: string;
}

export interface Formatters {
  date: (iso: string) => string;
  number: (value: number) => string;
}

const DISPLAY_OPTION_WORDS: Record<string, string> = {
  displayOnce: "Shown once per person",
  displayMultiple: "Shown until the person answers",
  respondMultiple: "Shown every time, answers allowed repeatedly",
  displaySome: "Shown a limited number of times",
};

/**
 * The settings that change what a respondent experiences or when the survey is reachable, as label and
 * value lines. Settings at their defaults are left out: a list of "off" is noise.
 */
export const buildSettingLines = (
  survey: SurveyDocument,
  settings: PreviewSettings | null,
  format: Formatters
): SettingLine[] => {
  const lines: SettingLine[] = [];
  if (survey.visibility === "restricted") {
    lines.push({ label: "Visibility", value: "Restricted to its owner and administrators" });
  }
  if (!settings) return lines;

  if (settings.publishOn) lines.push({ label: "Scheduled to start", value: format.date(settings.publishOn) });
  if (settings.closeOn) lines.push({ label: "Closes on", value: format.date(settings.closeOn) });
  if (settings.autoComplete !== null) {
    lines.push({
      label: "Response limit",
      value: `Closes after ${format.number(settings.autoComplete)} responses`,
    });
  }
  if (settings.pinProtected) lines.push({ label: "Access", value: "Protected by a PIN" });
  if (settings.verifyEmail) lines.push({ label: "Access", value: "Respondents verify their email first" });
  if (settings.singleUse) lines.push({ label: "Links", value: "Single-use links" });
  if (settings.backButtonHidden) lines.push({ label: "Navigation", value: "No back button" });
  if (settings.autoProgress) lines.push({ label: "Navigation", value: "Moves on after each answer" });

  if (survey.type === "app") {
    if (settings.triggers.length > 0) {
      lines.push({ label: "Triggers", value: joinList(settings.triggers.map((trigger) => trigger.name)) });
    }
    if (settings.segment) {
      lines.push({
        label: "Audience",
        value: `${settings.segment.title}${settings.segment.filterCount > 0 ? ` (${settings.segment.filterCount} filters)` : " (everyone)"}`,
      });
    }
    lines.push({
      label: "Frequency",
      value: DISPLAY_OPTION_WORDS[settings.displayOption] ?? settings.displayOption,
    });
    if (settings.displayPercentage !== null) {
      lines.push({
        label: "Sampling",
        value: `Shown to ${settings.displayPercentage}% of matching visitors`,
      });
    }
    if (settings.displayLimit !== null && settings.displayLimit > 0) {
      lines.push({ label: "Display limit", value: `${settings.displayLimit} times` });
    }
    if (settings.recontactDays !== null) {
      lines.push({
        label: "Cooldown",
        value: `${settings.recontactDays} days before this person sees another survey`,
      });
    }
    if (settings.delaySeconds > 0)
      lines.push({ label: "Delay", value: `${settings.delaySeconds} seconds after the trigger` });
    if (settings.autoCloseSeconds !== null) {
      lines.push({
        label: "Auto close",
        value: `After ${settings.autoCloseSeconds} seconds without interaction`,
      });
    }
  }
  return lines;
};

const OPERATOR_PHRASES: Record<string, string> = {
  equals: "is",
  doesNotEqual: "is not",
  contains: "contains",
  doesNotContain: "does not contain",
  startsWith: "starts with",
  endsWith: "ends with",
  containsAnyOf: "contains any of",
  containsNoneOf: "contains none of",
  pathIsAnyOf: "is one of",
  pathIsNoneOf: "is none of",
  isGreaterThan: "is more than",
  isLessThan: "is less than",
  isGreaterThanOrEqual: "is at least",
  isLessThanOrEqual: "is at most",
  includes: "includes",
  doesNotInclude: "does not include",
  isSet: "is set",
  isNotSet: "is not set",
};

const OPERAND_PHRASES: Record<string, string> = {
  currentUrl: "page URL",
  pageReferrer: "referrer",
  entryReferrer: "entry referrer",
  queryParam: "query parameter",
  pagesViewed: "pages viewed",
  uniquePagesViewed: "unique pages viewed",
  timeOnSite: "seconds on site",
  visitedUrls: "visited pages",
  deviceType: "device",
  browser: "browser",
  screenWidth: "window width",
};

const describeShowCondition = (entry: JsonRecord): string => {
  const left = isRecord(entry.leftOperand) ? entry.leftOperand : {};
  const operand = asString(left.value);
  const key = isRecord(left.meta) ? asString(left.meta.key) : "";
  const right = isRecord(entry.rightOperand) ? entry.rightOperand.value : undefined;
  const value = Array.isArray(right)
    ? joinList(right.map(String), 4)
    : typeof right === "string" || typeof right === "number"
      ? String(right)
      : "";
  const operator = asString(entry.operator);
  return `${OPERAND_PHRASES[operand] ?? operand}${key ? ` "${key}"` : ""} ${OPERATOR_PHRASES[operator] ?? operator}${value ? ` ${value}` : ""}`;
};

const describeShowGroup = (group: JsonRecord, nested: boolean): string => {
  const parts = records(group.conditions).map((entry) =>
    Array.isArray(entry.conditions) ? describeShowGroup(entry, true) : describeShowCondition(entry)
  );
  const joined = parts.join(group.connector === "or" ? " or " : " and ");
  return nested && parts.length > 1 ? `(${joined})` : joined;
};

/** The conditions that must hold before an app survey shows, in words; empty when there are none. */
export const describeShowConditions = (survey: SurveyDocument): string => {
  const group = survey.distribution?.showConditions;
  if (!isRecord(group) || !Array.isArray(group.conditions) || group.conditions.length === 0) return "";
  return describeShowGroup(group, false);
};
