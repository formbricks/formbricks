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

type TReferenceLookup = {
  elementIds: Set<string>;
  variableIds: Set<string>;
  hiddenFieldIds: Set<string>;
};
type TInvalidParamReferenceType = Exclude<InvalidParam["referenceType"], undefined>;

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
  referenceType: TInvalidParamReferenceType,
  issues: InvalidParam[]
): void {
  const firstPathById = new Map<string, string>();

  entries.forEach(({ id, path }) => {
    const firstPath = firstPathById.get(id);
    if (firstPath !== undefined) {
      issues.push({
        name: path,
        reason: `${label} id '${id}' is duplicated; first used at ${firstPath}`,
        code: "duplicate_identifier",
        identifier: id,
        referenceType,
        firstUsedAt: firstPath,
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
  referenceType: TInvalidParamReferenceType,
  issues: InvalidParam[]
): void {
  const firstIndexByValue = new Map<string, number>();

  values.forEach((value, index) => {
    const firstIndex = firstIndexByValue.get(value);
    if (firstIndex !== undefined) {
      issues.push({
        name: pathForIndex(index),
        reason: `${label} '${value}' is duplicated; first used at ${pathForIndex(firstIndex)}`,
        code: "duplicate_identifier",
        identifier: value,
        referenceType,
        firstUsedAt: pathForIndex(firstIndex),
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
      code: "duplicate_identifier",
      identifier: entry.id,
      referenceType: entry.namespace,
      conflictsWith: firstEntry.path,
    });
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function addRecallReferenceIssues(
  value: unknown,
  path: string,
  references: TReferenceLookup,
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
          code: "dangling_reference",
          identifier: recallId,
          referenceType: "recall",
          missingId: recallId,
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

function addMetadataRecallReferenceIssues(
  metadata: unknown,
  references: TReferenceLookup,
  issues: InvalidParam[]
): void {
  if (!isPlainObject(metadata)) {
    return;
  }

  addRecallReferenceIssues(metadata.title, "metadata.title", references, issues);
  addRecallReferenceIssues(metadata.description, "metadata.description", references, issues);
}

function validateDynamicOperand(
  operand: TDynamicLogicFieldValue,
  path: string,
  references: TReferenceLookup,
  issues: InvalidParam[]
): void {
  if (operand.type === "element" && !references.elementIds.has(operand.value)) {
    issues.push({
      name: `${path}.value`,
      reason: `Element id '${operand.value}' is not defined in blocks`,
      code: "dangling_reference",
      identifier: operand.value,
      referenceType: "element",
      missingId: operand.value,
    });
  }

  if (operand.type === "variable" && !references.variableIds.has(operand.value)) {
    issues.push({
      name: `${path}.value`,
      reason: `Variable id '${operand.value}' is not defined in variables`,
      code: "dangling_reference",
      identifier: operand.value,
      referenceType: "variable",
      missingId: operand.value,
    });
  }

  if (operand.type === "hiddenField" && !references.hiddenFieldIds.has(operand.value)) {
    issues.push({
      name: `${path}.value`,
      reason: `Hidden field id '${operand.value}' is not defined in hiddenFields.fieldIds`,
      code: "dangling_reference",
      identifier: operand.value,
      referenceType: "hiddenField",
      missingId: operand.value,
    });
  }
}

function validateConditionGroup(
  conditionGroup: TConditionGroup,
  path: string,
  references: TReferenceLookup,
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
  const navigationTargetReferenceTypes = new Map<string, "block" | "ending">([
    ...blockIds.map((id) => [id, "block"] as const),
    ...endingIds.map((id) => [id, "ending"] as const),
  ]);
  const references = {
    elementIds: new Set(elementIds),
    variableIds: new Set(variableIds),
    hiddenFieldIds: new Set(hiddenFieldIds),
  };

  addDuplicateIdIssues(blockEntries, "Block", "block", issues);
  addDuplicateIdIssues(endingEntries, "Ending", "ending", issues);
  addDuplicateIdIssues(elementEntries, "Element", "element", issues);
  addDuplicateIdIssues(variableIdEntries, "Variable", "variable", issues);
  addDuplicateValueIssues(
    hiddenFieldIds,
    (index) => `hiddenFields.fieldIds.${index}`,
    "Hidden field id",
    "hiddenField",
    issues
  );
  addDuplicateValueIssues(
    variableNames,
    (index) => `variables.${index}.name`,
    "Variable name",
    "variableName",
    issues
  );
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
    if (block.logicFallback && !block.logic?.length) {
      issues.push({
        name: `blocks.${blockIndex}.logicFallback`,
        reason:
          "logicFallback requires at least one logic rule on the same block; omit logicFallback for normal sequential flow or add blocks[].logic",
        code: "invalid_reference",
        identifier: block.logicFallback,
        referenceType: navigationTargetReferenceTypes.get(block.logicFallback) ?? "block",
      });
    }

    if (block.logicFallback && block.logicFallback === block.id) {
      issues.push({
        name: `blocks.${blockIndex}.logicFallback`,
        reason: "logicFallback cannot target the same block",
        code: "invalid_reference",
        identifier: block.logicFallback,
        referenceType: "block",
      });
    }

    if (block.logicFallback && !navigationTargetIds.has(block.logicFallback)) {
      issues.push({
        name: `blocks.${blockIndex}.logicFallback`,
        reason: `Logic fallback target '${block.logicFallback}' is not defined in blocks or endings`,
        code: "dangling_reference",
        identifier: block.logicFallback,
        referenceType: "block",
        missingId: block.logicFallback,
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
              code: "dangling_reference",
              identifier: action.variableId,
              referenceType: "variable",
              missingId: action.variableId,
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
            code: "dangling_reference",
            identifier: action.target,
            referenceType: "element",
            missingId: action.target,
          });
        }

        if (action.objective === "jumpToBlock" && !navigationTargetIds.has(action.target)) {
          issues.push({
            name: `${actionPath}.target`,
            reason: `Jump target '${action.target}' is not defined in blocks or endings`,
            code: "dangling_reference",
            identifier: action.target,
            referenceType: "block",
            missingId: action.target,
          });
        }
      });
    });
  });

  addRecallReferenceIssues(input.blocks, "blocks", references, issues);
  addRecallReferenceIssues(input.endings, "endings", references, issues);
  addRecallReferenceIssues(input.welcomeCard, "welcomeCard", references, issues);
  addMetadataRecallReferenceIssues(input.metadata, references, issues);

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

/**
 * Ordering rules (ENG-3069).
 *
 * The existing checks above verify that a reference *resolves*; none of them cares where the target
 * sits in the flow. That gap only mattered while reordering meant hand-rewriting the whole `blocks`
 * array — rare enough that nobody hit it. A one-call reorder makes it routine, so a survey that
 * recalls an answer the respondent has not given yet becomes easy to create, and it passes every
 * other server check.
 *
 * Three rules, each mirroring what the editor or the shared refinement already enforces:
 *
 *  - a recall of an element must point strictly backwards in flat element order
 *    (`recall-item-select.tsx` filters the picker the same way);
 *  - a logic condition's element left operand must not sit in a later block, same block allowed
 *    (mirrors `validateBlockConditions` in `packages/types/surveys/types.ts`);
 *  - a `requireAnswer` target must sit in a *later* block (mirrors `validateBlockActions`).
 *
 * `jumpToBlock` and `logicFallback` deliberately have no ordering rule — jumping backwards is a
 * legitimate survey design, and only cycles are policed.
 *
 * Violations carry a stable key so the patch path can report only the ones a request *introduces*.
 * The key never contains an array index: a reorder shifts every index, and diffing on those would
 * report the whole survey as newly broken.
 */
type TPrecedenceViolation = { key: string; issue: InvalidParam };

type TElementPosition = { blockIndex: number; flatIndex: number; path: string };

function buildElementPositions(blocks: TSurveyBlocks): Map<string, TElementPosition> {
  const positions = new Map<string, TElementPosition>();
  let flatIndex = 0;

  blocks.forEach((block, blockIndex) => {
    block.elements.forEach((element, elementIndex) => {
      // First occurrence wins; duplicates are already reported as duplicate_identifier.
      if (!positions.has(element.id)) {
        positions.set(element.id, {
          blockIndex,
          flatIndex,
          path: `blocks.${blockIndex}.elements.${elementIndex}`,
        });
      }
      flatIndex += 1;
    });
  });

  return positions;
}

function misorderedIssue(
  name: string,
  reason: string,
  identifier: string,
  referenceType: TInvalidParamReferenceType
): InvalidParam {
  return { name, reason, code: "misordered_reference", identifier, referenceType };
}

/** Walk any nested value for `#recall:` tokens, reporting those that point at or after `position`. */
function addRecallPrecedenceViolations(
  value: unknown,
  path: string,
  position: number,
  scopeKey: string,
  positions: Map<string, TElementPosition>,
  violations: TPrecedenceViolation[]
): void {
  if (typeof value === "string") {
    for (const match of value.matchAll(/#recall:([A-Za-z0-9_-]+)/g)) {
      const recallId = match[1];
      const target = positions.get(recallId);
      // Unknown ids, variables and hidden fields are not position-checked: the first is a dangling
      // reference (reported elsewhere) and the other two are available from the start.
      if (!target || target.flatIndex < position) {
        continue;
      }

      violations.push({
        key: `recall|${scopeKey}|${recallId}`,
        issue: misorderedIssue(
          path,
          position < 0
            ? `Recall reference '${recallId}' cannot be used here because no element has been answered yet; only hidden fields and variables can be recalled before the first block`
            : `Recall reference '${recallId}' points at an element that appears later in the survey (${target.path}); a recall can only use elements shown before it`,
          recallId,
          "recall"
        ),
      });
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry, index) =>
      addRecallPrecedenceViolations(entry, `${path}.${index}`, position, scopeKey, positions, violations)
    );
    return;
  }

  if (!isPlainObject(value)) {
    return;
  }

  for (const [key, entry] of Object.entries(value)) {
    // Logic runs at block submit, by which point the block's own answers exist — walking it here
    // would flag a same-block recall that is actually fine.
    if (key === "logic") continue;
    addRecallPrecedenceViolations(
      entry,
      path ? `${path}.${key}` : key,
      position,
      scopeKey,
      positions,
      violations
    );
  }
}

function forEachSingleCondition(
  group: TConditionGroup,
  path: string,
  visit: (condition: { leftOperand: TDynamicLogicFieldValue }, conditionPath: string) => void
): void {
  group.conditions.forEach((condition, index) => {
    const conditionPath = `${path}.conditions.${index}`;
    if ("conditions" in condition) {
      forEachSingleCondition(condition, conditionPath, visit);
      return;
    }
    visit(condition, conditionPath);
  });
}

function getV3SurveyPrecedenceViolations(input: TReferenceValidationInput): TPrecedenceViolation[] {
  const positions = buildElementPositions(input.blocks);
  const violations: TPrecedenceViolation[] = [];

  // Before the first element: an element recall here can never resolve to an answer.
  addRecallPrecedenceViolations(input.welcomeCard, "welcomeCard", -1, "welcomeCard", positions, violations);
  if (isPlainObject(input.metadata)) {
    for (const key of ["title", "description"] as const) {
      addRecallPrecedenceViolations(
        input.metadata[key],
        `metadata.${key}`,
        -1,
        `metadata.${key}`,
        positions,
        violations
      );
    }
  }

  input.blocks.forEach((block, blockIndex) => {
    const firstElementFlatIndex = positions.get(block.elements[0]?.id ?? "")?.flatIndex ?? 0;

    // Block-level labels render with the block, so they may only recall earlier blocks' answers.
    for (const key of ["name", "buttonLabel", "backButtonLabel"] as const) {
      addRecallPrecedenceViolations(
        block[key],
        `blocks.${blockIndex}.${key}`,
        firstElementFlatIndex,
        `block:${block.id}`,
        positions,
        violations
      );
    }

    block.elements.forEach((element, elementIndex) => {
      const position = positions.get(element.id);
      addRecallPrecedenceViolations(
        element,
        `blocks.${blockIndex}.elements.${elementIndex}`,
        position?.flatIndex ?? 0,
        `element:${element.id}`,
        positions,
        violations
      );
    });

    block.logic?.forEach((logic, logicIndex) => {
      const logicPath = `blocks.${blockIndex}.logic.${logicIndex}`;

      forEachSingleCondition(logic.conditions, logicPath, (condition, conditionPath) => {
        if (condition.leftOperand.type !== "element") return;
        const target = positions.get(condition.leftOperand.value);
        if (!target || target.blockIndex <= blockIndex) return;

        violations.push({
          key: `condition|${block.id}|${condition.leftOperand.value}`,
          issue: misorderedIssue(
            `${conditionPath}.leftOperand.value`,
            `Condition references element '${condition.leftOperand.value}' in a later block (blocks.${target.blockIndex}); logic in blocks.${blockIndex} can only evaluate elements from the same or an earlier block`,
            condition.leftOperand.value,
            "element"
          ),
        });
      });

      logic.actions.forEach((action, actionIndex) => {
        if (action.objective !== "requireAnswer") return;
        const target = positions.get(action.target);
        if (!target || target.blockIndex > blockIndex) return;

        violations.push({
          key: `requireAnswer|${block.id}|${action.target}`,
          issue: misorderedIssue(
            `${logicPath}.actions.${actionIndex}.target`,
            target.blockIndex === blockIndex
              ? `requireAnswer target '${action.target}' is in the same block (blocks.${blockIndex}); requireAnswer must target an element in a later block`
              : `requireAnswer target '${action.target}' is in an earlier block (blocks.${target.blockIndex}); requireAnswer must target an element in a later block`,
            action.target,
            "element"
          ),
        });
      });
    });
  });

  return violations;
}

/** Every ordering violation in the document. Used on create, where there is no baseline to spare. */
export function getV3SurveyPrecedenceInvalidParams(input: TReferenceValidationInput): InvalidParam[] {
  return getV3SurveyPrecedenceViolations(input).map((violation) => violation.issue);
}

/**
 * Only the ordering violations this change *introduces*.
 *
 * Enforcing the full set on a patch would brick every survey that already contains one — including a
 * patch that never touches the offending block. That is the ENG-3070 failure class, and it is the
 * reason this rule is a delta rather than an absolute.
 */
export function getV3SurveyIntroducedPrecedenceInvalidParams(
  baseline: TReferenceValidationInput,
  input: TReferenceValidationInput
): InvalidParam[] {
  const existing = new Set(getV3SurveyPrecedenceViolations(baseline).map((violation) => violation.key));

  return getV3SurveyPrecedenceViolations(input)
    .filter((violation) => !existing.has(violation.key))
    .map((violation) => violation.issue);
}
