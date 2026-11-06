/**
 * Planner for the matrix condition id backfill (ENG-6934, ADR 0032).
 *
 * Pure: a stored row in, "unchanged" or the full replacement for one JSON column out. No database, no
 * app imports. A data migration must keep doing what it did on the day it shipped, so the sync rules
 * below are a deliberate copy of `withMatrixConditionIds` (packages/types/surveys/matrix-conditions.ts)
 * rather than an import of code that will keep changing. `utils.test.ts` runs both on the same fixtures
 * so the two cannot drift silently while this migration is still unreleased.
 *
 * Rules (json-shapes §10): a condition on one matrix row stores the row position in
 * `leftOperand.meta.row` and the column position(s) in its static right operand's `value`. The
 * backfill **adds** `meta.rowId` and `columnId` (`columnIds` for a list of positions, `isAnyOf`) next
 * to them, and never removes or rewrites a position: the previous release's pods read positions only
 * during the rolling upgrade. Where ids are already there, they win and the positions are synced to
 * them. An id the matrix doesn't have, a position out of range, or a matrix without row or column ids
 * is left as it is.
 */

type TRecord = Record<string, unknown>;

interface TMatrixAxes {
  rows: readonly unknown[];
  columns: readonly unknown[];
}

type TFindMatrix = (elementId: string) => TMatrixAxes | undefined;

/** One survey as the migration reads it. `blocks` arrives untyped: it is stored data. */
export interface TSurveyMatrixRow {
  id: string;
  /** `updated_at` as Postgres prints it. Used only as the compare-and-set token of the write. */
  updatedAt: string;
  blocks: unknown;
}

/** One quota, with the blocks of the survey it belongs to. */
export interface TQuotaMatrixRow {
  id: string;
  updatedAt: string;
  logic: unknown;
  blocks: unknown;
}

export type TMatrixIdsPlan = { status: "unchanged" } | { status: "update"; value: unknown };

const isRecord = (value: unknown): value is TRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const idOf = (item: unknown): string | undefined =>
  isRecord(item) && typeof item.id === "string" ? item.id : undefined;

const indexAt = (position: unknown, length: number): number | undefined => {
  if (typeof position !== "string" && typeof position !== "number") return undefined;
  if (typeof position === "string" && position.trim() === "") return undefined;
  const index = Number(position);
  return Number.isInteger(index) && index >= 0 && index < length ? index : undefined;
};

const indexOfId = (list: readonly unknown[], id: unknown): number | undefined => {
  if (typeof id !== "string") return undefined;
  const index = list.findIndex((item) => idOf(item) === id);
  return index === -1 ? undefined : index;
};

const sameList = (a: unknown, b: readonly string[]): boolean =>
  Array.isArray(a) && a.length === b.length && a.every((item, index) => item === b[index]);

const syncColumns = (matrix: TMatrixAxes, operand: TRecord): TRecord => {
  const { columns } = matrix;
  if (operand.columnIds !== undefined) {
    if (!Array.isArray(operand.columnIds)) return operand;
    const positions = (operand.columnIds as unknown[]).map((id) => indexOfId(columns, id));
    if (positions.includes(undefined)) return operand;
    const value = positions.map(String);
    return sameList(operand.value, value) ? operand : { ...operand, value };
  }
  if (operand.columnId !== undefined) {
    const position = indexOfId(columns, operand.columnId);
    if (position === undefined || operand.value === String(position)) return operand;
    return { ...operand, value: String(position) };
  }
  if (Array.isArray(operand.value)) {
    const ids = (operand.value as unknown[]).map((position) =>
      idOf(columns[indexAt(position, columns.length) ?? -1])
    );
    if (ids.includes(undefined)) return operand;
    return { ...operand, columnIds: ids };
  }
  const columnId = idOf(columns[indexAt(operand.value, columns.length) ?? -1]);
  return columnId === undefined ? operand : { ...operand, columnId };
};

const syncCondition = (condition: unknown, findMatrix: TFindMatrix): unknown => {
  if (!isRecord(condition)) return condition;
  const { leftOperand, rightOperand } = condition;
  if (!isRecord(leftOperand) || leftOperand.type !== "element" || typeof leftOperand.value !== "string") {
    return condition;
  }
  const meta = leftOperand.meta;
  if (!isRecord(meta) || (meta.row === undefined && meta.rowId === undefined)) return condition;
  const matrix = findMatrix(leftOperand.value);
  if (!matrix) return condition;

  let next: TRecord = condition;
  const rowIndex =
    meta.rowId !== undefined ? indexOfId(matrix.rows, meta.rowId) : indexAt(meta.row, matrix.rows.length);
  const rowId = rowIndex === undefined ? undefined : idOf(matrix.rows[rowIndex]);
  if (rowIndex !== undefined && rowId !== undefined) {
    const row = String(rowIndex);
    if (meta.row !== row || meta.rowId !== rowId) {
      next = { ...next, leftOperand: { ...leftOperand, meta: { ...meta, row, rowId } } };
    }
  }

  if (isRecord(rightOperand) && rightOperand.type === "static") {
    const synced = syncColumns(matrix, rightOperand);
    if (synced !== rightOperand) next = { ...next, rightOperand: synced };
  }
  return next;
};

/** A condition group (or a quota's `logic`, which has the same `conditions` list) in sync. */
export const syncConditionGroup = (group: unknown, findMatrix: TFindMatrix): unknown => {
  if (!isRecord(group) || !Array.isArray(group.conditions)) return group;
  const original = group.conditions as unknown[];
  const conditions = original.map((condition) =>
    isRecord(condition) && Array.isArray(condition.conditions)
      ? syncConditionGroup(condition, findMatrix)
      : syncCondition(condition, findMatrix)
  );
  return conditions.every((condition, index) => condition === original[index])
    ? group
    : { ...group, conditions };
};

export const getMatrixLookup = (blocks: unknown): TFindMatrix => {
  const matrices = new Map<string, TMatrixAxes>();
  if (Array.isArray(blocks)) {
    for (const block of blocks as unknown[]) {
      if (!isRecord(block) || !Array.isArray(block.elements)) continue;
      for (const element of block.elements as unknown[]) {
        if (
          isRecord(element) &&
          element.type === "matrix" &&
          typeof element.id === "string" &&
          Array.isArray(element.rows) &&
          Array.isArray(element.columns)
        ) {
          matrices.set(element.id, {
            rows: element.rows as unknown[],
            columns: element.columns as unknown[],
          });
        }
      }
    }
  }
  return (elementId) => matrices.get(elementId);
};

const mapKeepingIdentity = (
  list: readonly unknown[],
  update: (item: unknown) => unknown
): readonly unknown[] => {
  const mapped = list.map(update);
  return mapped.every((item, index) => item === list[index]) ? list : mapped;
};

const withSyncedShowIf = (item: unknown, findMatrix: TFindMatrix): unknown => {
  if (!isRecord(item) || !isRecord(item.showIf)) return item;
  const showIf = syncConditionGroup(item.showIf, findMatrix);
  return showIf === item.showIf ? item : { ...item, showIf };
};

/**
 * Every matrix row condition in a survey's blocks in sync: block logic, block and question show-if,
 * and option show-if. Blocks nothing changed in keep their identity.
 */
export const syncBlocks = (blocks: readonly unknown[]): unknown[] => {
  const findMatrix = getMatrixLookup(blocks);
  const syncElement = (element: unknown): unknown => {
    const withShowIf = withSyncedShowIf(element, findMatrix);
    if (!isRecord(withShowIf)) return withShowIf;
    let next: TRecord = withShowIf;
    for (const key of ["choices", "rows", "columns"] as const) {
      const list = next[key];
      if (!Array.isArray(list)) continue;
      const synced = mapKeepingIdentity(list as unknown[], (option) => withSyncedShowIf(option, findMatrix));
      if (synced !== list) next = { ...next, [key]: synced };
    }
    return next;
  };

  return blocks.map((block) => {
    const withShowIf = withSyncedShowIf(block, findMatrix);
    if (!isRecord(withShowIf)) return block;
    let next: TRecord = withShowIf;
    if (Array.isArray(next.logic)) {
      const logic = mapKeepingIdentity(next.logic as unknown[], (rule) => {
        if (!isRecord(rule)) return rule;
        const conditions = syncConditionGroup(rule.conditions, findMatrix);
        return conditions === rule.conditions ? rule : { ...rule, conditions };
      });
      if (logic !== next.logic) next = { ...next, logic };
    }
    if (Array.isArray(next.elements)) {
      const elements = mapKeepingIdentity(next.elements as unknown[], syncElement);
      if (elements !== next.elements) next = { ...next, elements };
    }
    return next;
  });
};

export const planSurveyMatrixIds = (row: TSurveyMatrixRow): TMatrixIdsPlan => {
  if (!Array.isArray(row.blocks) || row.blocks.length === 0) return { status: "unchanged" };
  const source = row.blocks as unknown[];
  const synced = syncBlocks(source);
  const changed = synced.some((block, index) => block !== source[index]);
  return changed ? { status: "update", value: synced } : { status: "unchanged" };
};

export const planQuotaMatrixIds = (row: TQuotaMatrixRow): TMatrixIdsPlan => {
  const synced = syncConditionGroup(row.logic, getMatrixLookup(row.blocks));
  return synced === row.logic ? { status: "unchanged" } : { status: "update", value: synced };
};
