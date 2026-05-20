import type { TSurveyBlocks } from "@formbricks/types/surveys/blocks";
import type { TConditionGroup, TDynamicLogicFieldValue } from "@formbricks/types/surveys/logic";
import type { TSurveyEndings, TSurveyHiddenFields, TSurveyVariables } from "@formbricks/types/surveys/types";
import type { InvalidParam } from "@/app/api/v3/lib/response";

type TReferenceValidationInput = {
  blocks: TSurveyBlocks;
  endings: TSurveyEndings;
  hiddenFields: TSurveyHiddenFields;
  metadata?: unknown;
  variables: TSurveyVariables;
  welcomeCard?: unknown;
};

type TNamedReference = {
  id: string;
  path: string;
  namespace: "block" | "element" | "ending" | "hiddenField" | "variable" | "variableName";
};

export class V3SurveyReferenceValidationError extends Error {
  invalidParams: InvalidParam[];

  constructor(invalidParams: InvalidParam[]) {
    super("Survey contains invalid references");
    this.name = "V3SurveyReferenceValidationError";
    this.invalidParams = invalidParams;
  }
}

export type TV3SurveyReferenceValidationResult =
  | { ok: true; invalidParams: [] }
  | { ok: false; invalidParams: InvalidParam[] };

function addDuplicateIdIssues(
  entries: { id: string; path: string }[],
  label: string,
  issues: InvalidParam[]
): void {
  const firstPathById = new Map<string, string>();

  entries.forEach(({ id, path }) => {
    const firstPath = firstPathById.get(id);
    if (firstPath !== undefined) {
      issues.push({
        name: path,
        reason: `${label} id '${id}' is duplicated; first used at ${firstPath}`,
      });
      return;
    }

    firstPathById.set(id, path);
  });
}

function addDuplicateValueIssues(
  values: string[],
  pathForIndex: (index: number) => string,
  label: string,
  issues: InvalidParam[]
): void {
  const firstIndexByValue = new Map<string, number>();

  values.forEach((value, index) => {
    const firstIndex = firstIndexByValue.get(value);
    if (firstIndex !== undefined) {
      issues.push({
        name: pathForIndex(index),
        reason: `${label} '${value}' is duplicated; first used at ${pathForIndex(firstIndex)}`,
      });
      return;
    }

    firstIndexByValue.set(value, index);
  });
}

function addCrossNamespaceCollisionIssues(entries: TNamedReference[], issues: InvalidParam[]): void {
  const firstEntryById = new Map<string, TNamedReference>();

  entries.forEach((entry) => {
    const lookupId = entry.id.toLowerCase();
    const firstEntry = firstEntryById.get(lookupId);

    if (!firstEntry) {
      firstEntryById.set(lookupId, entry);
      return;
    }

    if (firstEntry.namespace === entry.namespace) {
      return;
    }

    issues.push({
      name: entry.path,
      reason: `${entry.namespace} identifier '${entry.id}' conflicts with ${firstEntry.namespace} identifier at ${firstEntry.path}`,
    });
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addRecallReferenceIssues(
  value: unknown,
  path: string,
  references: {
    elementIds: Set<string>;
    variableIds: Set<string>;
    hiddenFieldIds: Set<string>;
  },
  issues: InvalidParam[]
): void {
  if (typeof value === "string") {
    const recallPattern = /#recall:([A-Za-z0-9_-]+)/g;

    for (const match of value.matchAll(recallPattern)) {
      const recallId = match[1];
      const isKnownReference =
        references.elementIds.has(recallId) ||
        references.variableIds.has(recallId) ||
        references.hiddenFieldIds.has(recallId);

      if (!isKnownReference) {
        issues.push({
          name: path,
          reason: `Recall reference '${recallId}' is not defined in blocks, variables, or hiddenFields.fieldIds`,
        });
      }
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) => addRecallReferenceIssues(entry, `${path}.${index}`, references, issues));
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  Object.entries(value).forEach(([key, entry]) => {
    addRecallReferenceIssues(entry, path ? `${path}.${key}` : key, references, issues);
  });
}

function validateDynamicOperand(
  operand: TDynamicLogicFieldValue,
  path: string,
  references: {
    elementIds: Set<string>;
    variableIds: Set<string>;
    hiddenFieldIds: Set<string>;
  },
  issues: InvalidParam[]
): void {
  if (operand.type === "element" && !references.elementIds.has(operand.value)) {
    issues.push({
      name: `${path}.value`,
      reason: `Element id '${operand.value}' is not defined in blocks`,
    });
  }

  if (operand.type === "variable" && !references.variableIds.has(operand.value)) {
    issues.push({
      name: `${path}.value`,
      reason: `Variable id '${operand.value}' is not defined in variables`,
    });
  }

  if (operand.type === "hiddenField" && !references.hiddenFieldIds.has(operand.value)) {
    issues.push({
      name: `${path}.value`,
      reason: `Hidden field id '${operand.value}' is not defined in hiddenFields.fieldIds`,
    });
  }
}

function validateConditionGroup(
  conditionGroup: TConditionGroup,
  path: string,
  references: {
    elementIds: Set<string>;
    variableIds: Set<string>;
    hiddenFieldIds: Set<string>;
  },
  issues: InvalidParam[]
): void {
  conditionGroup.conditions.forEach((condition, index) => {
    const conditionPath = `${path}.conditions.${index}`;

    if ("conditions" in condition) {
      validateConditionGroup(condition, conditionPath, references, issues);
      return;
    }

    validateDynamicOperand(condition.leftOperand, `${conditionPath}.leftOperand`, references, issues);

    if (condition.rightOperand?.type && condition.rightOperand.type !== "static") {
      validateDynamicOperand(condition.rightOperand, `${conditionPath}.rightOperand`, references, issues);
    }
  });
}

export function getV3SurveyReferenceInvalidParams(input: TReferenceValidationInput): InvalidParam[] {
  const issues: InvalidParam[] = [];
  const blockIds = input.blocks.map((block) => block.id);
  const blockEntries = input.blocks.map((block, index) => ({
    id: block.id,
    path: `blocks.${index}.id`,
  }));
  const endingIds = input.endings.map((ending) => ending.id);
  const endingEntries = input.endings.map((ending, index) => ({
    id: ending.id,
    path: `endings.${index}.id`,
  }));
  const elementEntries = input.blocks.flatMap((block, blockIndex) =>
    block.elements.map((element, elementIndex) => ({
      id: element.id,
      path: `blocks.${blockIndex}.elements.${elementIndex}.id`,
    }))
  );
  const elementIds = elementEntries.map((element) => element.id);
  const hiddenFieldIds = input.hiddenFields.fieldIds ?? [];
  const hiddenFieldEntries = hiddenFieldIds.map((id, index) => ({
    id,
    path: `hiddenFields.fieldIds.${index}`,
  }));
  const variableIds = input.variables.map((variable) => variable.id);
  const variableIdEntries = variableIds.map((id, index) => ({
    id,
    path: `variables.${index}.id`,
  }));
  const variableNames = input.variables.map((variable) => variable.name);
  const variableNameEntries = variableNames.map((id, index) => ({
    id,
    path: `variables.${index}.name`,
  }));
  const navigationTargetIds = new Set([...blockIds, ...endingIds]);
  const references = {
    elementIds: new Set(elementIds),
    variableIds: new Set(variableIds),
    hiddenFieldIds: new Set(hiddenFieldIds),
  };

  addDuplicateIdIssues(blockEntries, "Block", issues);
  addDuplicateIdIssues(elementEntries, "Element", issues);
  addDuplicateIdIssues(variableIdEntries, "Variable", issues);
  addDuplicateValueIssues(
    hiddenFieldIds,
    (index) => `hiddenFields.fieldIds.${index}`,
    "Hidden field id",
    issues
  );
  addDuplicateValueIssues(variableNames, (index) => `variables.${index}.name`, "Variable name", issues);
  addCrossNamespaceCollisionIssues(
    [
      ...blockEntries.map((entry) => ({ ...entry, namespace: "block" as const })),
      ...elementEntries.map((entry) => ({ ...entry, namespace: "element" as const })),
      ...endingEntries.map((entry) => ({ ...entry, namespace: "ending" as const })),
      ...hiddenFieldEntries.map((entry) => ({ ...entry, namespace: "hiddenField" as const })),
      ...variableIdEntries.map((entry) => ({ ...entry, namespace: "variable" as const })),
      ...variableNameEntries.map((entry) => ({ ...entry, namespace: "variableName" as const })),
    ],
    issues
  );

  input.blocks.forEach((block, blockIndex) => {
    if (block.logicFallback && !navigationTargetIds.has(block.logicFallback)) {
      issues.push({
        name: `blocks.${blockIndex}.logicFallback`,
        reason: `Logic fallback target '${block.logicFallback}' is not defined in blocks or endings`,
      });
    }

    block.logic?.forEach((logic, logicIndex) => {
      const logicPath = `blocks.${blockIndex}.logic.${logicIndex}`;
      validateConditionGroup(logic.conditions, `${logicPath}.conditions`, references, issues);

      logic.actions.forEach((action, actionIndex) => {
        const actionPath = `${logicPath}.actions.${actionIndex}`;

        if (action.objective === "calculate") {
          if (!references.variableIds.has(action.variableId)) {
            issues.push({
              name: `${actionPath}.variableId`,
              reason: `Variable id '${action.variableId}' is not defined in variables`,
            });
          }

          if (action.value.type !== "static") {
            validateDynamicOperand(action.value, `${actionPath}.value`, references, issues);
          }
        }

        if (action.objective === "requireAnswer" && !references.elementIds.has(action.target)) {
          issues.push({
            name: `${actionPath}.target`,
            reason: `Element id '${action.target}' is not defined in blocks`,
          });
        }

        if (action.objective === "jumpToBlock" && !navigationTargetIds.has(action.target)) {
          issues.push({
            name: `${actionPath}.target`,
            reason: `Jump target '${action.target}' is not defined in blocks or endings`,
          });
        }
      });
    });
  });

  addRecallReferenceIssues(input.blocks, "blocks", references, issues);
  addRecallReferenceIssues(input.endings, "endings", references, issues);
  addRecallReferenceIssues(input.welcomeCard, "welcomeCard", references, issues);
  addRecallReferenceIssues(input.metadata, "metadata", references, issues);

  return issues;
}

export function validateV3SurveyReferences(
  input: TReferenceValidationInput
): TV3SurveyReferenceValidationResult {
  const invalidParams = getV3SurveyReferenceInvalidParams(input);

  if (invalidParams.length > 0) {
    return { ok: false, invalidParams };
  }

  return { ok: true, invalidParams: [] };
}

export function assertValidV3SurveyReferences(input: TReferenceValidationInput): void {
  const result = validateV3SurveyReferences(input);

  if (!result.ok) {
    throw new V3SurveyReferenceValidationError(result.invalidParams);
  }
}
