import { TFunction } from "i18next";
import { getLanguageLabel } from "@formbricks/i18n-utils/utils";
import { ZSegmentFilters } from "@formbricks/types/segment";
import { TSurvey, TSurveyEditorTabs, TSurveyStatus, ZSurvey } from "@formbricks/types/surveys/types";
import { checkForEmptyFallBackValue } from "@/lib/utils/recall";
import { describeCodeIssueAtPath } from "./code-messages";
import { isConditionalLogicMessage, toFlowTabMessage, withoutFlowPrefix } from "./flow-error-message";
import { getLogicDestinationErrorMessage } from "./logic-destination-error";
import {
  TDescribableIssue,
  getElementFieldLabel,
  hasValidSurveyClosedMessageHeading,
  humanizeFieldName,
  isMissingRequiredTrigger,
  isZodGeneratedMessage,
} from "./validation";

// The tabs an issue can live on: every tab but the one that lists them.
export type TIssueTab = Exclude<TSurveyEditorTabs, "review">;

/**
 * One thing that stops a survey from being published, with where it is and what to do about it.
 *
 * `level` follows the design: a "field" issue belongs to one input (message above the input, red border),
 * a "question" issue to a whole card or a group inside it (message at the top of the card, red bar).
 */
export interface TEditorIssue {
  key: string;
  tab: TIssueTab;
  /** DOM id of the card or row the issue lives on: element id, block id, "start", an ending id or a rule id. */
  targetId: string | null;
  level: "field" | "question";
  /** The input inside the card, e.g. "headline" or "choices.2.label"; null when the whole card is meant. */
  field: string | null;
  /** Short, fix-first text, shown next to the field. */
  message: string;
  /** Where the issue is, for the summary, e.g. "Block 1, Question 2". Null when the message says it itself. */
  location: string | null;
  /** Set on the per-language "missing translations" entries, which point at the Language tab. */
  languageCode?: string;
}

// Fields ElementFormInput renders itself, so the issue can sit next to the input. Anything else is
// listed at the top of its card instead.
const INLINE_FIELD_PATTERN =
  /^(headline|subheader|html|placeholder|upperLabel|lowerLabel|label|imageAltText|buttonLabel|backButtonLabel|ctaButtonLabel|otherOptionPlaceholder|(choices|rows|columns)\.\d+\.label)$/;

export const isInlineIssueField = (field: string | null): boolean =>
  field !== null && INLINE_FIELD_PATTERN.test(field);

/** The issue field an ElementFormInput `id` stands for: `choice-2` is the schema's `choices.2.label`. */
export const toIssueFieldKey = (inputId: string): string => {
  const match = /^(choice|row|column)-(\d+)$/.exec(inputId);
  if (!match) return inputId;
  return `${match[1]}s.${match[2]}.label`;
};

const I18N_FIELDS = new Set([
  "headline",
  "subheader",
  "html",
  "label",
  "placeholder",
  "upperLabel",
  "lowerLabel",
  "buttonLabel",
  "backButtonLabel",
  "dismissButtonLabel",
  "ctaButtonLabel",
  "imageAltText",
]);

const COLLECTION_FIELDS = new Set(["choices", "rows", "columns", "images"]);

type TPath = (string | number)[];

// A choice, row or column that is missing its text is reported on the entry itself (`choices.2`), while the
// input that edits it is the entry's label.
const toSchemaFieldKey = (field: string | null): string | null =>
  field && /^(choices|rows|columns)\.\d+$/.test(field) ? `${field}.label` : field;

/**
 * Splits what follows an element in an issue path into the field and, for a translated field, the
 * language the issue is about (`headline.de` is the German headline).
 */
const splitFieldPath = (fieldPath: TPath): { field: string | null; languageCode?: string } => {
  const parts: string[] = [];
  let languageCode: string | undefined;

  fieldPath.forEach((segment, index) => {
    if (typeof segment === "string" && index > 0 && I18N_FIELDS.has(String(fieldPath[index - 1]))) {
      languageCode = segment;
      return;
    }
    parts.push(String(segment));
  });

  return { field: parts.length ? parts.join(".") : null, languageCode };
};

// A language added to the survey has no entry at all on a field until it is translated; the schema words that
// as "... is not present for the following languages: de", with no params to read the language from.
const ABSENT_TRANSLATION_PATTERN = /is not present for the following languages: (.+)$/;

const getInvalidLanguageCodes = (issue: TDescribableIssue & { params?: unknown }): string[] => {
  // "Choice labels are duplicated in German" names languages too, but it is about duplicates, not translations.
  if (/duplicate/i.test(issue.message)) return [];
  const codes = (issue.params as { invalidLanguageCodes?: unknown } | undefined)?.invalidLanguageCodes;
  if (Array.isArray(codes)) return codes.filter((code): code is string => typeof code === "string");
  const absent = ABSENT_TRANSLATION_PATTERN.exec(issue.message)?.[1];
  return absent ? absent.split(",").map((code) => code.trim()) : [];
};

/** Inline text for a field the author left empty. Literal t() calls so the translation scanner sees every key. */
const getMissingTextMessage = (field: string, isCard: boolean, t: TFunction): string | null => {
  if (field === "headline") {
    return isCard
      ? t("workspace.surveys.edit.issue_enter_headline")
      : t("workspace.surveys.edit.issue_enter_question");
  }
  if (field === "subheader" || field === "html") return t("workspace.surveys.edit.issue_enter_description");
  if (/^choices\.\d+\.label$/.test(field)) return t("workspace.surveys.edit.issue_enter_option");
  if (/^rows\.\d+\.label$/.test(field)) return t("workspace.surveys.edit.issue_enter_row");
  if (/^columns\.\d+\.label$/.test(field)) return t("workspace.surveys.edit.issue_enter_column");
  if (field === "placeholder" || field === "otherOptionPlaceholder") {
    return t("workspace.surveys.edit.issue_enter_placeholder");
  }
  if (field === "imageAltText" || /^choices\.\d+\.imageAltText$/.test(field)) {
    return t("workspace.surveys.edit.issue_enter_alt_text");
  }
  if (INLINE_FIELD_PATTERN.test(field)) return t("workspace.surveys.edit.issue_enter_label");
  return null;
};

// The schema words an empty translated field as "... is missing" (see validateElementLabels).
const isMissingTextIssue = (issue: TDescribableIssue): boolean =>
  (issue.code === "custom" && / is missing$/.test(issue.message)) ||
  issue.code === "invalid_type" ||
  (issue.code === "too_small" && issue.origin === "string");

const getFieldIssueMessage = (
  issue: TDescribableIssue,
  field: string | null,
  options: { isCard: boolean; elementType?: string },
  t: TFunction
): string => {
  if (field && isMissingTextIssue(issue)) {
    const missing = getMissingTextMessage(field, options.isCard, t);
    if (missing) return missing;
  }

  if (issue.code === "invalid_format" && (issue.format === "url" || field?.toLowerCase().endsWith("url"))) {
    return t("workspace.surveys.edit.issue_enter_valid_url");
  }

  if (issue.code === "too_small" && issue.origin === "array") {
    const count = Number(issue.minimum ?? 1);
    return options.elementType === "pictureSelection"
      ? t("workspace.surveys.edit.issue_add_at_least_images", { count })
      : t("workspace.surveys.edit.issue_add_at_least_options", { count });
  }

  // A message the schema authored ("Cal user name is required") is already about this field.
  if (issue.code === "custom" && !isZodGeneratedMessage(issue)) return issue.message;

  if (!field) return t("workspace.surveys.edit.issue_this_is_required");
  return t("workspace.surveys.edit.issue_check_field", {
    field: getElementFieldLabel(field.split(".")[0], t) ?? humanizeFieldName(field.split(".")[0]),
  });
};

const makeKey = (issue: Omit<TEditorIssue, "key">): string =>
  [issue.tab, issue.targetId, issue.field, issue.languageCode, issue.message].join("|");

const withKey = (issue: Omit<TEditorIssue, "key">): TEditorIssue => ({ ...issue, key: makeKey(issue) });

// The schema names a welcome or ending card's fields differently from the inputs that edit them.
const CARD_FIELD_TO_INPUT: Record<string, string> = {
  cardHeadline: "headline",
  welcomeCardSubheader: "subheader",
  welcomeCardHtml: "subheader",
  endingCardButtonLabel: "buttonLabel",
};

const mapCardIssue = (
  issue: TDescribableIssue,
  targetId: string | null,
  fieldPath: TPath,
  location: string,
  t: TFunction
): TEditorIssue => {
  const schemaField = splitFieldPath(fieldPath).field;
  const field = schemaField ? (CARD_FIELD_TO_INPUT[schemaField] ?? schemaField) : null;
  return withKey({
    tab: "elements",
    targetId,
    level: field && !COLLECTION_FIELDS.has(field) ? "field" : "question",
    field,
    message: getFieldIssueMessage(issue, field, { isCard: true }, t),
    location,
  });
};

const mapRuleIssue = (
  issue: TDescribableIssue,
  survey: TSurvey,
  ruleIds: string[],
  t: TFunction
): TEditorIssue[] => {
  const message =
    getLogicDestinationErrorMessage(issue as never, survey.blocks, t) ??
    getConditionMessage(issue.message, t) ??
    toFlowTabMessage(issue.message, t("workspace.surveys.edit.flow.tab"));

  const targets = ruleIds.length ? ruleIds : [null];
  return targets.map((targetId) =>
    withKey({ tab: "flow", targetId, level: "field", field: null, message, location: null })
  );
};

const getShowIfItemLabel = (collection: string, n: number, t: TFunction): string => {
  if (collection === "rows") return t("common.row_n", { n });
  if (collection === "columns") return t("common.column_n", { n });
  return t("common.choice_n", { n });
};

/** A condition the schema rejects, in the author's words: the schema talks about "operands" and "operators". */
const getConditionMessage = (schemaMessage: string, t: TFunction): string | null => {
  // An operator that takes no value was given one: asking for a value would say the opposite of what to fix.
  if (/should not be (present|defined)/i.test(schemaMessage)) return null;
  if (/left operand/i.test(schemaMessage)) return t("workspace.surveys.edit.issue_show_if_question");
  if (/right operand/i.test(schemaMessage)) return t("workspace.surveys.edit.issue_show_if_value");
  return null;
};

const getShowIfMessage = (schemaMessage: string, t: TFunction): string =>
  getConditionMessage(schemaMessage, t) ?? withoutFlowPrefix(schemaMessage);

/**
 * A show-if that does not hold together: the condition of a block, a question or one of its options. These
 * are written on the Flow tab, so that is where they are listed, though the schema reports them under the
 * question's path.
 */
const mapShowIfIssue = (
  issue: TDescribableIssue,
  survey: TSurvey,
  path: TPath,
  t: TFunction
): TEditorIssue => {
  const blockIndex = typeof path[1] === "number" ? path[1] : -1;
  const block = survey.blocks[blockIndex];
  const elementIndex = path[2] === "elements" && typeof path[3] === "number" ? path[3] : null;
  const element = elementIndex === null ? undefined : block?.elements[elementIndex];

  // Whose show-if it is: the block's or the question's own (`showIf`), or one of the question's options.
  const showIfIndex = path.indexOf("showIf");
  const ownerPath = path.slice(
    elementIndex === null ? 2 : 4,
    showIfIndex === -1 ? undefined : showIfIndex + 1
  );
  const field = ownerPath.length > 0 ? ownerPath.join(".") : "showIf";
  const item = /^(choices|rows|columns)\.(\d+)\.showIf$/.exec(field);
  const message = getShowIfMessage(issue.message, t);

  return withKey({
    tab: "flow",
    targetId: element?.id ?? block?.id ?? null,
    level: "field",
    field,
    message: item
      ? t("workspace.surveys.edit.issue_item_show_if", {
          item: getShowIfItemLabel(item[1], Number(item[2]) + 1, t),
          message,
        })
      : t("workspace.surveys.edit.issue_show_if", { message }),
    location: element
      ? t("workspace.surveys.edit.issue_location_question", {
          blockNumber: blockIndex + 1,
          questionNumber: (elementIndex ?? 0) + 1,
        })
      : t("workspace.surveys.edit.block_n", { blockNumber: blockIndex + 1 }),
  });
};

const getIssuePath = (issue: TDescribableIssue): TPath =>
  issue.path.filter((part): part is string | number => typeof part !== "symbol");

// Where a survey-level problem most likely lives, by the first segment of its path.
const SURVEY_LEVEL_TABS = new Map<string, TIssueTab>([
  ["customCss", "styling"],
  ["styling", "styling"],
  ["languages", "language"],
  ["followUps", "followUps"],
  ["triggers", "settings"],
  ["segment", "settings"],
]);

/** A problem about the survey as a whole: it names the tab it most likely lives on. */
const mapSurveyLevelIssue = (issue: TDescribableIssue, root: string | number | undefined, t: TFunction) => {
  const known = typeof root === "string" ? SURVEY_LEVEL_TABS.get(root) : undefined;
  const fallbackTab: TIssueTab = isConditionalLogicMessage(issue.message) ? "flow" : "elements";

  return withKey({
    tab: known ?? fallbackTab,
    targetId: null,
    level: "question",
    field: typeof root === "string" ? root : null,
    message: toFlowTabMessage(issue.message, t("workspace.surveys.edit.flow.tab")),
    location: null,
  });
};

const mapElementIssue = (
  issue: TDescribableIssue,
  survey: TSurvey,
  path: TPath,
  [blockIndex, elementIndex]: [number, number],
  t: TFunction
): TEditorIssue[] => {
  const element = survey.blocks[blockIndex]?.elements[elementIndex];
  if (!element) return [];
  const location = t("workspace.surveys.edit.issue_location_question", {
    blockNumber: blockIndex + 1,
    questionNumber: elementIndex + 1,
  });
  const field = toSchemaFieldKey(splitFieldPath(path.slice(4)).field);

  const codeMessage = describeCodeIssueAtPath(survey, path, t);
  if (codeMessage) {
    return [
      withKey({
        tab: "elements",
        targetId: element.id,
        level: "field",
        field: "code",
        message: codeMessage,
        location,
      }),
    ];
  }

  return [
    withKey({
      tab: "elements",
      targetId: element.id,
      level: field && !COLLECTION_FIELDS.has(field) ? "field" : "question",
      field,
      message: getFieldIssueMessage(issue, field, { isCard: false, elementType: element.type }, t),
      location,
    }),
  ];
};

/** A problem under one block, or null when the path is not one the editor knows a place for. */
const mapBlockIssue = (
  issue: TDescribableIssue,
  survey: TSurvey,
  path: TPath,
  blockIndex: number,
  t: TFunction
): TEditorIssue[] | null => {
  const block = survey.blocks[blockIndex];

  // Rules and show-ifs live on the Flow tab, wherever in the survey's path the schema found them.
  const isRuleOrFallback = path[2] === "logic" || path[2] === "logicFallback";
  if (path.includes("showIf") || (!isRuleOrFallback && isConditionalLogicMessage(issue.message))) {
    return [mapShowIfIssue(issue, survey, path, t)];
  }

  if (path[2] === "elements" && typeof path[3] === "number") {
    return mapElementIssue(issue, survey, path, [blockIndex, path[3]], t);
  }

  if ((path[2] === "buttonLabel" || path[2] === "backButtonLabel") && block) {
    return [
      withKey({
        tab: "elements",
        targetId: block.id,
        level: "field",
        field: path[2],
        message: getFieldIssueMessage(issue, path[2], { isCard: false }, t),
        location: t("workspace.surveys.edit.block_n", { blockNumber: blockIndex + 1 }),
      }),
    ];
  }

  if (path[2] === "name" && block) {
    return [
      withKey({
        tab: "elements",
        targetId: block.id,
        level: "field",
        field: "name",
        message: t("workspace.surveys.edit.issue_enter_block_name"),
        location: t("workspace.surveys.edit.block_n", { blockNumber: blockIndex + 1 }),
      }),
    ];
  }

  if (path[2] === "logic") {
    const rules = typeof path[3] === "number" ? [block?.logic?.[path[3]]] : (block?.logic ?? []);
    return mapRuleIssue(
      issue,
      survey,
      rules.flatMap((rule) => (rule ? [rule.id] : [])),
      t
    );
  }

  return path[2] === "logicFallback" ? mapRuleIssue(issue, survey, [], t) : null;
};

/** Turns one schema issue into editor issues. */
const mapZodIssue = (issue: TDescribableIssue, survey: TSurvey, t: TFunction): TEditorIssue[] => {
  const path = getIssuePath(issue);
  const [root] = path;

  if (root === "blocks" && typeof path[1] === "number") {
    const found = mapBlockIssue(issue, survey, path, path[1], t);
    if (found) return found;
  }

  if (root === "startLogic") {
    const rule = typeof path[1] === "number" ? survey.startLogic?.[path[1]] : undefined;
    return mapRuleIssue(issue, survey, rule ? [rule.id] : [], t);
  }

  if (root === "welcomeCard") {
    return [mapCardIssue(issue, "start", path.slice(1), t("common.welcome_card"), t)];
  }

  if (root === "endings") {
    const endingIndex = typeof path[1] === "number" ? path[1] : -1;
    const location = t("workspace.surveys.edit.issue_location_ending", { number: endingIndex + 1 });
    return [mapCardIssue(issue, survey.endings[endingIndex]?.id ?? null, path.slice(2), location, t)];
  }

  if (root === "showConditions") {
    return [
      withKey({
        tab: "settings",
        targetId: null,
        level: "question",
        field: "showConditions",
        message: t("workspace.surveys.edit.show_conditions.invalid"),
        location: null,
      }),
    ];
  }

  return [mapSurveyLevelIssue(issue, root, t)];
};

/** The languages a "missing translation" schema issue is about; none for any other issue. */
const getMissingLanguageCodes = (issue: TDescribableIssue, path: TPath): string[] => {
  const fromIssue = getInvalidLanguageCodes(issue);
  if (fromIssue.length) return fromIssue;

  const pathLanguage =
    path[0] === "blocks" && path[2] === "elements" ? splitFieldPath(path.slice(4)).languageCode : undefined;
  return pathLanguage && pathLanguage !== "default" ? [pathLanguage] : [];
};

// One condition missing its value is reported twice (once for the operand, once for its type): it is one
// problem to fix, so only the first report of each show-if is kept.
const isRepeatedShowIf = (found: TEditorIssue, kept: TEditorIssue[]): boolean =>
  found.tab === "flow" &&
  !!found.field?.endsWith("showIf") &&
  kept.some(
    (issue) => issue.tab === "flow" && issue.targetId === found.targetId && issue.field === found.field
  );

/** Everything the survey schema objects to, in the editor's words. */
export const getSchemaIssues = (survey: TSurvey, t: TFunction, locale: string): TEditorIssue[] => {
  const parsed = ZSurvey.safeParse(survey);
  if (parsed.success) return [];

  const issues: TEditorIssue[] = [];
  const missingByLanguage = new Map<string, number>();

  for (const zodIssue of parsed.error.issues) {
    const issue = zodIssue as unknown as TDescribableIssue;

    // "German is missing 3 translations": counted here, reported once per language below.
    const codes = getMissingLanguageCodes(issue, getIssuePath(issue));
    if (codes.length) {
      for (const code of codes) missingByLanguage.set(code, (missingByLanguage.get(code) ?? 0) + 1);
      continue;
    }

    for (const found of mapZodIssue(issue, survey, t)) {
      if (!isRepeatedShowIf(found, issues)) issues.push(found);
    }
  }

  for (const [languageCode, count] of missingByLanguage) {
    issues.push(
      withKey({
        tab: "language",
        targetId: null,
        level: "question",
        field: null,
        languageCode,
        message: t("workspace.surveys.edit.issue_language_missing_translations", {
          language: getLanguageLabel(languageCode, locale) ?? languageCode,
          count,
        }),
        location: null,
      })
    );
  }

  return issues;
};

interface TSurveyRuleContext {
  survey: TSurvey;
  selectedLanguageCode: string;
  finishedResponseCount?: number;
}

/** The checks beyond the schema: a recall fallback left empty, targeting, the response limit, the closed message. */
export const getSurveyRuleIssues = (
  { survey, selectedLanguageCode, finishedResponseCount }: TSurveyRuleContext,
  t: TFunction
): TEditorIssue[] => {
  const issues: TEditorIssue[] = [];
  const settingsIssue = (field: string, message: string) =>
    withKey({ tab: "settings", targetId: null, level: "question", field, message, location: null });

  const questionWithEmptyFallback = checkForEmptyFallBackValue(survey, selectedLanguageCode);
  if (questionWithEmptyFallback) {
    issues.push(
      withKey({
        tab: "elements",
        targetId: questionWithEmptyFallback.id,
        level: "question",
        field: "fallback",
        message: t("workspace.surveys.edit.fallback_missing"),
        location: null,
      })
    );
  }

  if (survey.type === "app" && survey.segment?.id === "temp") {
    const parsedFilters = ZSegmentFilters.safeParse(survey.segment.filters);
    if (!parsedFilters.success) {
      const message =
        parsedFilters.error.issues.find((issue) => issue.code === "custom")?.message ||
        t("workspace.surveys.edit.invalid_targeting");
      issues.push(settingsIssue("targeting", message));
    }
  }

  if (survey.autoComplete !== null && finishedResponseCount !== undefined) {
    if (survey.autoComplete === 0) {
      issues.push(
        settingsIssue("responseLimit", t("workspace.surveys.edit.response_limit_can_t_be_set_to_0"))
      );
    } else if (survey.autoComplete <= finishedResponseCount) {
      issues.push(
        settingsIssue(
          "responseLimit",
          t("workspace.surveys.edit.response_limit_needs_to_exceed_number_of_received_responses", {
            responseCount: finishedResponseCount,
          })
        )
      );
    }
  }

  if (!hasValidSurveyClosedMessageHeading(survey)) {
    issues.push(
      settingsIssue("closedMessage", t("workspace.surveys.edit.survey_closed_message_heading_required"))
    );
  }

  return issues;
};

/** Custom CSS the server would refuse: the Styling tab says why. */
export const getCustomCssIssue = (t: TFunction): TEditorIssue =>
  withKey({
    tab: "styling",
    targetId: null,
    level: "question",
    field: "customCss",
    message: t("workspace.custom_css.fix_errors_before_saving"),
    location: null,
  });

/**
 * The status a save from the editor heads for, which decides whether a missing trigger counts: a draft goes
 * live, or is scheduled (and so lands paused) when it has a publish date; a live survey keeps its status.
 */
export const getPublishTargetStatus = (survey: Pick<TSurvey, "status" | "publishOn">): TSurveyStatus => {
  if (survey.status !== "draft") return survey.status;
  return survey.publishOn ? "paused" : "inProgress";
};

export interface TCollectIssuesContext extends TSurveyRuleContext {
  /** The status the survey is heading for: publishing needs a trigger, a plain draft save does not. */
  targetStatus: TSurveyStatus;
  isOpenedByCreative: boolean;
  isCustomCssBlocking: boolean;
  locale: string;
}

/** Every issue standing between the survey and a successful save at `targetStatus`. */
export const collectEditorIssues = (context: TCollectIssuesContext, t: TFunction): TEditorIssue[] => {
  const issues: TEditorIssue[] = [];

  if (isMissingRequiredTrigger(context.survey, context.targetStatus, context.isOpenedByCreative)) {
    issues.push(
      withKey({
        tab: "settings",
        targetId: null,
        level: "field",
        field: "trigger",
        message: t("workspace.surveys.edit.please_set_a_survey_trigger"),
        location: null,
      })
    );
  }

  if (context.isCustomCssBlocking) issues.push(getCustomCssIssue(t));

  issues.push(...getSchemaIssues(context.survey, t, context.locale), ...getSurveyRuleIssues(context, t));

  // The same problem can come up twice (two schema issues on one field).
  const seen = new Set<string>();
  return issues.filter((issue) => !seen.has(issue.key) && !!seen.add(issue.key));
};

/** What decides whether two issues are "the same place": the card it sits on, else the tab and field. */
const getIssueIdentity = (issue: TEditorIssue): string =>
  issue.targetId ?? `${issue.tab}:${issue.field ?? ""}:${issue.languageCode ?? ""}`;

/**
 * After the first failed attempt the issues follow the survey as the author edits. A place that was not
 * flagged then stays unflagged, so a question just added and not yet filled in is not marked until the
 * next publish; places already flagged update, and disappear once fixed.
 */
export const reconcileIssues = (previous: TEditorIssue[], next: TEditorIssue[]): TEditorIssue[] => {
  const flagged = new Set(previous.map(getIssueIdentity));
  return next.filter((issue) => flagged.has(getIssueIdentity(issue)));
};

export const areIssueListsEqual = (a: TEditorIssue[], b: TEditorIssue[]): boolean =>
  a.length === b.length && a.every((issue, index) => issue.key === b[index].key);

/** The ids of every card or row carrying an issue; what the red bars and borders are drawn from. */
export const getIssueTargetIds = (issues: TEditorIssue[]): string[] => [
  ...new Set(issues.flatMap((issue) => (issue.targetId ? [issue.targetId] : []))),
];

const TAB_ORDER: TIssueTab[] = ["elements", "flow", "settings", "styling", "language", "followUps"];

/** Issues in the order a person would work through the editor, tabs left to right, then survey order. */
export const sortIssuesForSummary = (issues: TEditorIssue[]): TEditorIssue[] =>
  [...issues].sort((a, b) => TAB_ORDER.indexOf(a.tab) - TAB_ORDER.indexOf(b.tab));

/** How many issues each tab has, in the order the summary lists the tabs; tabs with none are left out. */
export const countIssuesByTab = (issues: TEditorIssue[]): { tab: TIssueTab; count: number }[] =>
  TAB_ORDER.map((tab) => ({ tab, count: issues.filter((issue) => issue.tab === tab).length })).filter(
    ({ count }) => count > 0
  );

/** The issues of one field of one card; the card's own "whole card" issues have a null field. */
export const getFieldIssue = (
  issues: TEditorIssue[],
  targetId: string,
  field: string | null
): TEditorIssue | undefined => issues.find((issue) => issue.targetId === targetId && issue.field === field);

/** The value of the `data-issue-field` attribute that marks a field's input, so a summary link can find it. */
export const getIssueFieldKey = (targetId: string, field: string): string => `${targetId}:${field}`;
