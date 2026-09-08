import { TSurveyElementTypeEnum } from "@formbricks/types/surveys/constants";
import { ZSurveyLogicConditionsOperator } from "@formbricks/types/surveys/logic";
import {
  V3_SURVEY_DOCUMENT_ROOT_KEYS,
  getUnsupportedV3SurveyDocumentFields,
} from "@/app/api/v3/surveys/schemas";
import { importError, importInfo } from "../report";
import type { TImportIssue } from "../types";
import { deleteAtPath, isRecord } from "./paths";

/** Fields no import may carry, whatever the source. Silently removed; they have no user-visible meaning. */
const INSTANCE_BOUND_FIELDS = [
  "id",
  "workspaceId",
  "createdAt",
  "updatedAt",
  "archivedAt",
  "createdBy",
  "customHeadScripts",
  "customHeadScriptsMode",
  "segmentId",
] as const;

const ELEMENT_TYPES = new Set<string>(Object.values(TSurveyElementTypeEnum));
const LOGIC_OPERATORS = new Set<string>(ZSurveyLogicConditionsOperator.options);

export type TDocumentHygieneResult = {
  document: Record<string, unknown>;
  issues: TImportIssue[];
};

function stripInstanceBoundFields(document: Record<string, unknown>, issues: TImportIssue[]): void {
  for (const field of INSTANCE_BOUND_FIELDS) {
    delete document[field];
  }

  if ("slug" in document) {
    delete document.slug;
    issues.push(importInfo({ code: "slug_not_imported", path: "slug" }));
  }

  if (document.publishOn != null || document.closeOn != null) {
    issues.push(importInfo({ code: "schedule_cleared", path: "publishOn" }));
  }
  delete document.publishOn;
  delete document.closeOn;

  if (document.status !== undefined && document.status !== "draft") {
    issues.push(
      importInfo({ code: "status_reset", path: "status", vars: { status: String(document.status) } })
    );
  }
  document.status = "draft";
}

/**
 * Unknown element types and logic operators cannot be stripped into something meaningful: a file
 * from a newer instance is fatal (edge case #68).
 */
function collectUnknownEnumIssues(document: Record<string, unknown>, issues: TImportIssue[]): void {
  const blocks = Array.isArray(document.blocks) ? document.blocks : [];

  blocks.forEach((block, blockIndex) => {
    if (!isRecord(block)) return;

    const elements = Array.isArray(block.elements) ? block.elements : [];
    elements.forEach((element, elementIndex) => {
      if (isRecord(element) && typeof element.type === "string" && !ELEMENT_TYPES.has(element.type)) {
        issues.push(
          importError({
            code: "unknown_element",
            path: `blocks.${blockIndex}.elements.${elementIndex}.type`,
            vars: { type: element.type },
          })
        );
      }
    });

    const logic = Array.isArray(block.logic) ? block.logic : [];
    logic.forEach((rule, ruleIndex) => {
      if (!isRecord(rule)) return;
      collectUnknownOperators(rule.conditions, `blocks.${blockIndex}.logic.${ruleIndex}.conditions`, issues);
    });
  });
}

function collectUnknownOperators(group: unknown, path: string, issues: TImportIssue[]): void {
  if (!isRecord(group) || !Array.isArray(group.conditions)) return;

  group.conditions.forEach((condition, index) => {
    if (!isRecord(condition)) return;
    const conditionPath = `${path}.conditions.${index}`;

    if (Array.isArray(condition.conditions)) {
      collectUnknownOperators(condition, conditionPath, issues);
      return;
    }

    if (typeof condition.operator === "string" && !LOGIC_OPERATORS.has(condition.operator)) {
      issues.push(
        importError({
          code: "unknown_element",
          path: `${conditionPath}.operator`,
          vars: { type: condition.operator },
        })
      );
    }
  });
}

/**
 * Strip and warn (D7). Every `unsupported_field` the create schema would reject is removed with its
 * path; the create-side validation later reports what is genuinely wrong. Unknown element types and
 * operators are fatal instead.
 */
export function applyDocumentHygiene(input: unknown): TDocumentHygieneResult {
  const issues: TImportIssue[] = [];
  const document: Record<string, unknown> = isRecord(input) ? structuredClone(input) : {};

  stripInstanceBoundFields(document, issues);
  collectUnknownEnumIssues(document, issues);

  const unsupportedFields = getUnsupportedV3SurveyDocumentFields(
    document,
    new Set(V3_SURVEY_DOCUMENT_ROOT_KEYS),
    typeof document.defaultLanguage === "string" ? document.defaultLanguage : undefined
  ).filter((param) => param.code === "unsupported_field");

  // Deepest paths first, so removing a parent never invalidates a child path we still hold.
  unsupportedFields
    .sort((left, right) => right.name.split(".").length - left.name.split(".").length)
    .forEach((param) => {
      if (deleteAtPath(document, param.name)) {
        issues.push(
          importInfo({
            code: "unknown_field_stripped",
            path: param.name,
            vars: { field: param.name.split(".").at(-1) ?? param.name },
          })
        );
      }
    });

  return { document, issues };
}
