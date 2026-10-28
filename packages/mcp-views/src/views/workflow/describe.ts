import { isRecord } from "../../shared/guards";
import { plural } from "../../shared/plural";
import type { WorkflowNode } from "./model";

/** A labelled fact about a step: "Subject", "Thanks for your response". Rendered as text only. */
export interface Detail {
  label: string;
  value: string;
}

export type ConditionTree =
  | { kind: "condition"; text: string }
  | { kind: "group"; connector: "and" | "or"; children: ConditionTree[] };

export const truncate = (value: string, max: number): string => {
  const text = value.trim();
  return text.length > max ? `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…` : text;
};

// Same tag shape as the workflows package's blank-body check: `<` + a tag name, no `<` or `>` inside, so a
// stray angle bracket in visible text survives and matching stays linear.
const HTML_TAG = /<\/?[a-zA-Z][^<>]*>/g;
const BLOCK_END = /<\/(p|div|li|h[1-6])>|<br\s*\/?>/gi;
const RECALL_TOKEN = /#recall:[^/#]*\/fallback:([^#]*)#/g;
const ENTITIES: Record<string, string> = {
  "&nbsp;": " ",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
};

/**
 * The visible text of a send_email body, as a short plain preview. A recall token (an answer the email
 * fills in per respondent) reads as "[answer]", or "[answer, else "there"]" when it has a fallback.
 */
export const htmlToPreviewText = (html: string, max = 160): string => {
  const text = html
    .replaceAll(BLOCK_END, " ")
    .replaceAll(HTML_TAG, "")
    .replaceAll(RECALL_TOKEN, (_match, fallback: string) =>
      fallback.trim() ? `[answer, else "${fallback.trim()}"]` : "[answer]"
    )
    .replaceAll(/&(nbsp|amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)
    .replaceAll(/\s+/g, " ");
  return truncate(text, max);
};

const OPERATOR_WORDS: Record<string, string> = {
  equals: "is",
  notEquals: "is not",
  lessThan: "is less than",
  lessEqual: "is at most",
  greaterThan: "is greater than",
  greaterEqual: "is at least",
  contains: "contains",
  notContains: "does not contain",
  exists: "is present",
  notExists: "is missing",
};

const describeValue = (value: unknown): string => {
  if (typeof value === "string") return `"${truncate(value, 80)}"`;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value === null) return "empty";
  if (isRecord(value) && typeof value.path === "string") {
    const fallback =
      typeof value.fallback === "string" && value.fallback ? ` (else "${value.fallback}")` : "";
    return `${value.path}${fallback}`;
  }
  return "a value";
};

const describeLeft = (left: unknown): string =>
  isRecord(left) && typeof left.path === "string" ? left.path : "a value";

const describeCondition = (condition: Record<string, unknown>): string => {
  const operator = typeof condition.operator === "string" ? condition.operator : "";
  const words = OPERATOR_WORDS[operator] ?? operator;
  const left = describeLeft(condition.left);
  return operator === "exists" || operator === "notExists"
    ? `${left} ${words}`
    : `${left} ${words} ${describeValue(condition.right)}`;
};

const MAX_CONDITION_DEPTH = 8;

/** A condition group as a tree of sentences: "response.score is greater than 8". */
export const describeConditionGroup = (group: unknown, depth = 0): ConditionTree | null => {
  if (!isRecord(group) || depth > MAX_CONDITION_DEPTH) return null;

  if (Array.isArray(group.conditions)) {
    const children = group.conditions.flatMap((child) => describeConditionGroup(child, depth + 1) ?? []);
    return { kind: "group", connector: group.connector === "or" ? "or" : "and", children };
  }
  if (typeof group.operator === "string") {
    return { kind: "condition", text: describeCondition(group) };
  }
  return null;
};

export const countConditions = (tree: ConditionTree | null): number => {
  if (!tree) return 0;
  return tree.kind === "condition"
    ? 1
    : tree.children.reduce((total, child) => total + countConditions(child), 0);
};

const TRIGGER_WORDS: Record<string, string> = {
  "response.completed": "A survey response is completed",
};

export const describeTrigger = (node: WorkflowNode): { summary: string; details: Detail[] } => {
  const summary = TRIGGER_WORDS[node.triggerType ?? ""] ?? `Trigger: ${node.triggerType ?? "unknown"}`;
  const details: Detail[] = [];

  const surveyId = typeof node.config.surveyId === "string" ? node.config.surveyId : undefined;
  details.push({ label: "Survey", value: surveyId ?? "Not chosen yet" });

  const endings = Array.isArray(node.config.endingCardIds) ? node.config.endingCardIds.length : 0;
  details.push({
    label: "Endings",
    value: endings === 0 ? "Any ending" : `Only ${plural(endings, "chosen ending")}`,
  });
  return { summary, details };
};

const isBlankBody = (value: unknown): boolean =>
  typeof value !== "string" || htmlToPreviewText(value, 1000).length === 0;

const describeRecipient = (to: unknown): string => {
  if (typeof to !== "string" || to.trim() === "") return "no recipient yet";
  // A literal address contains "@"; anything else is the id of the survey question that holds the
  // respondent's email.
  return to.includes("@") ? to.trim() : "the respondent (from their answer)";
};

export interface ActionDescription {
  summary: string;
  details: Detail[];
  /** What a draft still lacks, in words. Empty for a complete step. */
  missing: string[];
}

export const describeAction = (node: WorkflowNode): ActionDescription => {
  if (node.actionType !== "send_email") {
    return { summary: `Run ${node.actionType ?? "an action"}`, details: [], missing: [] };
  }

  const { config } = node;
  const details: Detail[] = [];
  const missing: string[] = [];

  if (typeof config.subject === "string" && config.subject.trim()) {
    details.push({ label: "Subject", value: truncate(config.subject, 120) });
  } else {
    missing.push("subject");
  }
  if (isBlankBody(config.body)) {
    missing.push("message");
  } else {
    details.push({ label: "Message", value: htmlToPreviewText(String(config.body)) });
  }
  if (typeof config.to !== "string" || config.to.trim() === "") missing.push("recipient");

  const replyTo = Array.isArray(config.replyTo) ? config.replyTo.filter((v) => typeof v === "string") : [];
  if (replyTo.length > 0) details.push({ label: "Replies go to", value: replyTo.join(", ") });

  const included: string[] = [];
  if (config.attachResponseData === true) included.push("response data");
  if (config.includeHiddenFields === true) included.push("hidden fields");
  if (config.includeVariables === true) included.push("variables");
  details.push({
    label: "Includes",
    value: included.length > 0 ? included.join(", ") : "Nothing from the response",
  });

  return { summary: `Send an email to ${describeRecipient(config.to)}`, details, missing };
};

/** `send_email` to "Send email": the name a step falls back to when nobody labelled it. */
export const humanizeStepType = (stepType: string): string => {
  const words = stepType.replaceAll(/[_.-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : "Step";
};

/** `attachResponseData` to "Attach response data": a record key as a label. */
export const humanizeKey = (key: string): string =>
  humanizeStepType(key.replaceAll(/([a-z0-9])([A-Z])/g, "$1 $2").toLowerCase());
