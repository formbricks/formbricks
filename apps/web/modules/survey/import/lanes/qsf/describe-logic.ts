import { importInfo } from "../../report";
import type { TImportIssue } from "../../types";
import { stripHtml } from "./strip-html";
import type { TQsfFlowNode, TQsfQuestion, TQsfSurvey } from "./types";

/**
 * Logic is not imported in v1 (D5). Every skip, display and branch rule is read only to be described
 * in plain language, so the user can rebuild it in the editor with the report open next to it.
 */

const UNREADABLE = "(could not be read) — check in Qualtrics";

const OPERATORS: Record<string, string> = {
  Selected: "=",
  NotSelected: "≠",
  EqualTo: "=",
  NotEqualTo: "≠",
  GreaterThan: ">",
  GreaterThanOrEqual: "≥",
  LessThan: "<",
  LessThanOrEqual: "≤",
  Contains: "contains",
  DoesNotContain: "does not contain",
  Displayed: "was shown",
  NotDisplayed: "was not shown",
  IsEmpty: "is empty",
  IsNotEmpty: "is not empty",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function questionLabel(model: TQsfSurvey, qid: string): string {
  const question = model.questions.get(qid);
  const tag = question?.exportTag ?? qid;
  const headline = question ? stripHtml(question.text) : "";
  return headline ? `${tag} '${truncate(headline)}'` : tag;
}

function truncate(text: string, max = 60): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function choiceLabel(question: TQsfQuestion | undefined, locator: string): string | null {
  const match = /\/(?:SelectableChoice|SelectableAnswer|ChoiceTextEntryValue)\/(\w+)$/.exec(locator);
  if (!match) return null;
  const choice =
    question?.choices.find((candidate) => candidate.id === match[1]) ??
    question?.answers.find((candidate) => candidate.id === match[1]);
  return choice ? `'${stripHtml(choice.display)}'` : `choice ${match[1]}`;
}

function describeExpression(model: TQsfSurvey, expression: Record<string, unknown>): string | null {
  const operator = typeof expression.Operator === "string" ? expression.Operator : null;
  const operatorText = operator
    ? (OPERATORS[operator] ?? operator.replaceAll(/([a-z])([A-Z])/g, "$1 $2").toLowerCase())
    : null;

  if (expression.LogicType === "Question" && typeof expression.QuestionID === "string" && operatorText) {
    const question = model.questions.get(expression.QuestionID);
    const locator =
      typeof expression.ChoiceLocator === "string"
        ? expression.ChoiceLocator
        : typeof expression.LeftOperand === "string"
          ? expression.LeftOperand
          : "";
    const choice = choiceLabel(question, locator);
    const right =
      choice ?? (typeof expression.RightOperand === "string" ? `'${expression.RightOperand}'` : "");
    return `${questionLabel(model, expression.QuestionID)} ${operatorText}${right ? ` ${right}` : ""}`.trim();
  }

  if (
    expression.LogicType === "EmbeddedField" &&
    typeof expression.LeftOperand === "string" &&
    operatorText
  ) {
    const right = typeof expression.RightOperand === "string" ? ` '${expression.RightOperand}'` : "";
    return `${expression.LeftOperand} ${operatorText}${right}`;
  }

  return null;
}

/** A `BooleanExpression`: numbered groups of numbered expressions, each carrying its `Conjuction`. */
export function describeBooleanExpression(model: TQsfSurvey, logic: unknown): string | null {
  if (!isRecord(logic)) return null;
  const groups = Object.entries(logic)
    .filter(([key, value]) => /^\d+$/.test(key) && isRecord(value))
    .map(([, value]) => value as Record<string, unknown>);
  if (groups.length === 0) return null;

  const parts: string[] = [];
  for (const group of groups) {
    const expressions = Object.entries(group)
      .filter(([key, value]) => /^\d+$/.test(key) && isRecord(value))
      .map(([, value]) => value as Record<string, unknown>);
    for (const expression of expressions) {
      const described = describeExpression(model, expression);
      if (described === null) return null;
      const conjunction =
        typeof expression.Conjuction === "string" ? expression.Conjuction.toLowerCase() : null;
      parts.push(parts.length > 0 && conjunction ? `${conjunction} ${described}` : described);
    }
  }

  return parts.length > 0 ? parts.join(" ") : null;
}

function destinationLabel(model: TQsfSurvey, destination: unknown): string {
  if (destination === "ENDOFSURVEY") return "the end of the survey";
  if (destination === "ENDOFBLOCK") return "the end of the block";
  if (typeof destination === "string") return questionLabel(model, destination);
  return "an unknown destination";
}

function describeSkipRules(model: TQsfSurvey, question: TQsfQuestion): string[] {
  const rules = Array.isArray(question.skipLogic) ? question.skipLogic : [];
  return rules.map((rule) => {
    if (!isRecord(rule)) return `${question.exportTag}: skip logic ${UNREADABLE}`;
    const choice = typeof rule.ChoiceLocator === "string" ? choiceLabel(question, rule.ChoiceLocator) : null;
    const condition = rule.Condition === "NotSelected" ? "≠" : "=";
    const destination = destinationLabel(model, rule.SkipToDestination);
    return choice
      ? `${question.exportTag}: if '${truncate(stripHtml(question.text))}' ${condition} ${choice}, skip to ${destination}`
      : `${question.exportTag}: skip logic to ${destination} ${UNREADABLE}`;
  });
}

function describeDisplayRule(model: TQsfSurvey, question: TQsfQuestion): string | null {
  if (question.displayLogic === null || question.displayLogic === undefined) return null;
  const condition = describeBooleanExpression(model, question.displayLogic);
  return condition
    ? `${question.exportTag} shown only if ${condition}`
    : `${question.exportTag}: display logic ${UNREADABLE}`;
}

function blockNames(model: TQsfSurvey, nodes: TQsfFlowNode[]): string[] {
  const names: string[] = [];
  for (const node of nodes) {
    if (node.type === "Block" || node.type === "Standard") {
      const block = model.blocks.find((candidate) => candidate.id === node.id);
      names.push(block?.description.trim() || node.id);
    } else if ("children" in node) {
      names.push(...blockNames(model, node.children));
    }
  }
  return names;
}

function describeBranches(
  model: TQsfSurvey,
  nodes: TQsfFlowNode[],
  previousBlock: string | null,
  into: { text: string; ref: string }[]
): string | null {
  let last = previousBlock;
  for (const node of nodes) {
    if (node.type === "Block" || node.type === "Standard") {
      last = model.blocks.find((candidate) => candidate.id === node.id)?.description.trim() || node.id;
      continue;
    }
    if (node.type === "Branch") {
      const condition = describeBooleanExpression(model, node.logic);
      const shown = blockNames(model, node.children);
      const where = last ? `Branch after '${last}'` : "Branch at the start";
      into.push({
        ref: node.description ?? "Branch",
        text: condition
          ? `${where}: if ${condition} show ${shown.length > 0 ? shown.map((name) => `'${name}'`).join(", ") : "nothing"}`
          : `${where}: branch logic ${UNREADABLE}`,
      });
      last = describeBranches(model, node.children, last, into) ?? last;
      continue;
    }
    if ("children" in node) {
      last = describeBranches(model, node.children, last, into) ?? last;
    }
  }
  return last;
}

export type TQsfLogicDescription = { issues: TImportIssue[]; count: number };

/** One `logic_dropped` info row per rule, preceded by a summary row when there is anything to list. */
export function describeQsfLogic(model: TQsfSurvey): TQsfLogicDescription {
  const rows: { text: string; ref: string }[] = [];

  for (const question of model.questions.values()) {
    for (const text of describeSkipRules(model, question)) rows.push({ text, ref: question.qid });
    const display = describeDisplayRule(model, question);
    if (display) rows.push({ text: display, ref: question.qid });
  }
  describeBranches(model, model.flow, null, rows);

  if (rows.length === 0) return { issues: [], count: 0 };

  const summary = importInfo({
    code: "logic_dropped",
    sourceRef: "Logic",
    vars: {
      detail: `${rows.length} logic ${rows.length === 1 ? "rule was" : "rules were"} not imported. Rebuild them in the editor; each one is listed below.`,
      count: rows.length,
    },
  });

  return {
    count: rows.length,
    issues: [
      summary,
      ...rows.map((row) =>
        importInfo({ code: "logic_dropped", sourceRef: row.ref, vars: { detail: row.text } })
      ),
    ],
  };
}
