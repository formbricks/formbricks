import type { TConditionGroup } from "./logic";

/**
 * Matrix conditions by id (ENG-6934, ADR 0026, json-shapes §10).
 *
 * A condition on one matrix row stores the row in `leftOperand.meta` and the column(s) in its static
 * right operand. Until 6.2 both were positions (`meta.row` = row index, `value` = column index), so
 * reordering rows or columns on a live survey pointed the condition at another cell. 6.2 stores the
 * ids next to the positions:
 *
 * ```ts
 * leftOperand  { type: "element", value: "<matrix id>", meta: { row: "1", rowId: "<row id>" } }
 * rightOperand { type: "static", value: "2", columnId: "<column id>" }
 * rightOperand { type: "static", value: ["0", "2"], columnIds: ["<id>", "<id>"] }   // isAnyOf
 * ```
 *
 * - **Readers** use the ids first and fall back to the positions; the ids win when the two disagree.
 * - **Writers** keep both in sync ({@link withMatrixConditionIds}), so the previous release's pods,
 *   which read positions only and strip the unknown `columnId`, evaluate the same cell during a
 *   rolling upgrade. Positions are dropped in a later, breaking release.
 *
 * Type-only imports: the survey bundle reads this file, and it must not pull zod in.
 */

/** The part of a matrix element a condition points into. */
export interface TMatrixAxes {
  rows: readonly { id: string }[];
  columns: readonly { id: string }[];
}

/** Finds the matrix element a condition names, or `undefined` when it isn't a matrix. */
export type TFindMatrix = (elementId: string) => TMatrixAxes | undefined;

/**
 * What a column id the matrix doesn't have resolves to. No column sits at `-1`, so the condition can
 * never match an answer, rather than silently falling back to a position the id contradicts.
 */
export const UNKNOWN_MATRIX_COLUMN = "-1";

type TMeta = Readonly<Record<string, string>> | undefined;

interface TStaticOperand {
  type: "static";
  value: string | number | string[];
  columnId?: string;
  columnIds?: string[];
}

/** Whether a matrix condition is about one row (rather than the whole matrix being submitted). */
export const isMatrixRowCondition = (meta: TMeta): boolean =>
  meta?.rowId !== undefined || meta?.row !== undefined;

/** A stored position as an index into a list of `length`, or `undefined` when it is out of range. */
const indexAt = (position: unknown, length: number): number | undefined => {
  if (typeof position !== "string" && typeof position !== "number") return undefined;
  if (typeof position === "string" && position.trim() === "") return undefined;
  const index = Number(position);
  return Number.isInteger(index) && index >= 0 && index < length ? index : undefined;
};

const indexOfId = (list: readonly { id: string }[], id: string): number | undefined => {
  const index = list.findIndex((item) => item.id === id);
  return index === -1 ? undefined : index;
};

/**
 * The index of the row a condition points at: its `rowId` when it has one (an unknown id resolves to
 * no row), else its `row` position.
 */
export const resolveMatrixRowIndex = (matrix: TMatrixAxes, meta: TMeta): number | undefined => {
  if (meta?.rowId !== undefined) return indexOfId(matrix.rows, meta.rowId);
  return indexAt(meta?.row, matrix.rows.length);
};

/**
 * The column position(s) a matrix row condition compares the answer with, in the form the engines
 * compare (the answered column's index as a string): `columnIds` / `columnId` first, else `value`.
 */
export const resolveMatrixColumnValue = (
  matrix: TMatrixAxes,
  operand: TStaticOperand
): string | number | string[] => {
  const positionOfId = (id: string): string => {
    const index = indexOfId(matrix.columns, id);
    return index === undefined ? UNKNOWN_MATRIX_COLUMN : String(index);
  };
  if (operand.columnIds !== undefined) return operand.columnIds.map(positionOfId);
  if (operand.columnId !== undefined) return positionOfId(operand.columnId);
  return operand.value;
};

/**
 * Whether a matrix row condition names a row or column id its matrix doesn't have (P48). Such a
 * condition never matches, whatever its operator: without this, a negated operator (`doesNotEqual`,
 * `isNotAnyOf`, `isSkipped`) would match every answer, because no answer sits at the unknown cell.
 */
export const namesUnknownMatrixId = (
  matrix: TMatrixAxes,
  meta: TMeta,
  operand: { type: string; columnId?: string; columnIds?: string[] } | undefined
): boolean => {
  if (meta?.rowId !== undefined && indexOfId(matrix.rows, meta.rowId) === undefined) return true;
  if (operand?.type !== "static") return false;
  if (operand.columnId !== undefined && indexOfId(matrix.columns, operand.columnId) === undefined)
    return true;
  return (operand.columnIds ?? []).some((id) => indexOfId(matrix.columns, id) === undefined);
};

const sameList = (a: unknown, b: readonly string[]): boolean =>
  Array.isArray(a) && a.length === b.length && a.every((item, index) => item === b[index]);

/**
 * The column side in sync. The id form wins and rewrites the positions; without ids, the positions
 * give the ids. An id the matrix doesn't have, or a position out of range, is left as it is: the
 * validator reports it.
 */
const syncColumns = <TOperand extends TStaticOperand>(matrix: TMatrixAxes, operand: TOperand): TOperand => {
  if (operand.columnIds !== undefined) {
    const positions = operand.columnIds.map((id) => indexOfId(matrix.columns, id));
    if (positions.some((position) => position === undefined)) return operand;
    const value = positions.map(String);
    return sameList(operand.value, value) ? operand : { ...operand, value };
  }
  if (operand.columnId !== undefined) {
    const position = indexOfId(matrix.columns, operand.columnId);
    if (position === undefined || operand.value === String(position)) return operand;
    return { ...operand, value: String(position) };
  }
  return withMatrixColumnIdsFromPositions(matrix, operand);
};

/**
 * Sets the column id(s) from the position(s) in `value`, replacing any ids already there. For an
 * editor that has just picked a column by position: there the position is what the author chose.
 */
export const withMatrixColumnIdsFromPositions = <TOperand extends TStaticOperand>(
  matrix: TMatrixAxes,
  operand: TOperand
): TOperand => {
  const { columnId: _columnId, columnIds: _columnIds, ...rest } = operand;
  if (Array.isArray(operand.value)) {
    const positions = operand.value.map((position) => indexAt(position, matrix.columns.length));
    if (positions.some((position) => position === undefined)) return operand;
    const columnIds = positions.map((position) => matrix.columns[position as number].id);
    return sameList(operand.columnIds, columnIds) && operand.columnId === undefined
      ? operand
      : ({ ...rest, columnIds } as TOperand);
  }
  const position = indexAt(operand.value, matrix.columns.length);
  if (position === undefined) return operand;
  const columnId = matrix.columns[position].id;
  return operand.columnId === columnId && operand.columnIds === undefined
    ? operand
    : ({ ...rest, columnId } as TOperand);
};

interface TConditionLike {
  leftOperand?: { type: string; value: string; meta?: Record<string, string> };
  rightOperand?: { type: string; value: unknown; columnId?: string; columnIds?: string[] };
}

const syncCondition = <TCondition extends TConditionLike>(
  condition: TCondition,
  findMatrix: TFindMatrix
): TCondition => {
  const { leftOperand, rightOperand } = condition;
  if (leftOperand?.type !== "element" || !isMatrixRowCondition(leftOperand.meta)) return condition;
  const matrix = findMatrix(leftOperand.value);
  if (!matrix) return condition;

  let next = condition;
  const meta = leftOperand.meta ?? {};
  const rowIndex = resolveMatrixRowIndex(matrix, meta);
  if (rowIndex !== undefined) {
    const row = String(rowIndex);
    const rowId = matrix.rows[rowIndex].id;
    if (meta.row !== row || meta.rowId !== rowId) {
      next = { ...next, leftOperand: { ...leftOperand, meta: { ...meta, row, rowId } } };
    }
  }

  if (rightOperand?.type === "static") {
    const synced = syncColumns(matrix, rightOperand as TStaticOperand);
    if (synced !== (rightOperand as TStaticOperand)) next = { ...next, rightOperand: synced };
  }
  return next;
};

interface TGroupLike {
  conditions: readonly unknown[];
}

const isGroupLike = (value: unknown): value is TGroupLike =>
  typeof value === "object" && value !== null && Array.isArray((value as TGroupLike).conditions);

/**
 * A condition group with every matrix row condition carrying both forms, in sync: the ids where only
 * positions were stored, and positions recomputed from the ids (after a reorder). Nothing is mutated;
 * an unchanged group keeps its identity. Works on block logic, show-if and quota conditions alike.
 */
export const withMatrixConditionIds = <TGroup extends TGroupLike>(
  group: TGroup,
  findMatrix: TFindMatrix
): TGroup => {
  const conditions = group.conditions.map((condition) =>
    isGroupLike(condition)
      ? withMatrixConditionIds(condition, findMatrix)
      : syncCondition(condition as TConditionLike, findMatrix)
  );
  const changed = conditions.some((condition, index) => condition !== group.conditions[index]);
  return changed ? { ...group, conditions } : group;
};

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/** Every matrix element of a survey's blocks, by id. */
export const getMatrixLookup = (blocks: readonly unknown[]): TFindMatrix => {
  const matrices = new Map<string, TMatrixAxes>();
  for (const block of blocks) {
    if (!isRecord(block) || !Array.isArray(block.elements)) continue;
    for (const element of block.elements as unknown[]) {
      if (
        isRecord(element) &&
        element.type === "matrix" &&
        typeof element.id === "string" &&
        Array.isArray(element.rows) &&
        Array.isArray(element.columns)
      ) {
        matrices.set(element.id, element as unknown as TMatrixAxes);
      }
    }
  }
  return (elementId) => matrices.get(elementId);
};

const withSyncedShowIf = <T>(item: T, findMatrix: TFindMatrix): T => {
  if (!isRecord(item) || !isGroupLike(item.showIf)) return item;
  const showIf = withMatrixConditionIds(item.showIf, findMatrix);
  return showIf === item.showIf ? item : { ...item, showIf };
};

const mapKeepingIdentity = <T>(list: readonly T[], update: (item: T) => T): readonly T[] => {
  const mapped = list.map(update);
  return mapped.every((item, index) => item === list[index]) ? list : mapped;
};

/**
 * Every matrix row condition stored in a survey's blocks, in sync (see {@link withMatrixConditionIds}):
 * block logic, block and question show-if, and option show-if. The one call every survey write path
 * makes, next to the question-code fill. Blocks nothing changed in keep their identity.
 */
export const withMatrixConditionIdsInBlocks = <TBlock>(blocks: readonly TBlock[]): TBlock[] => {
  const findMatrix = getMatrixLookup(blocks);
  const syncElement = (element: unknown): unknown => {
    const withShowIf: unknown = withSyncedShowIf(element, findMatrix);
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
    const withShowIf: unknown = withSyncedShowIf(block, findMatrix);
    if (!isRecord(withShowIf)) return block;
    let next: TRecord = withShowIf;
    if (Array.isArray(next.logic)) {
      const logic = mapKeepingIdentity(next.logic as unknown[], (rule) => {
        if (!isRecord(rule) || !isGroupLike(rule.conditions)) return rule;
        const conditions = withMatrixConditionIds(rule.conditions, findMatrix);
        return conditions === rule.conditions ? rule : { ...rule, conditions };
      });
      if (logic !== next.logic) next = { ...next, logic };
    }
    if (Array.isArray(next.elements)) {
      const elements = mapKeepingIdentity(next.elements as unknown[], syncElement);
      if (elements !== next.elements) next = { ...next, elements };
    }
    return next as TBlock;
  });
};

/** A matrix id that names no row or column of its matrix, at its exact path. */
export interface TMatrixIdIssue {
  path: (string | number)[];
  /** The id that names nothing. */
  id: string;
  message: string;
}

/**
 * The row and column ids in a condition group that its matrix doesn't have, each at the exact path of
 * the id, below `groupPath` (the group's own path in the survey document).
 */
export const findUnknownMatrixIds = (
  group: TConditionGroup,
  findMatrix: TFindMatrix,
  groupPath: (string | number)[]
): TMatrixIdIssue[] => {
  const issues: TMatrixIdIssue[] = [];
  group.conditions.forEach((condition, index) => {
    const path = [...groupPath, "conditions", index];
    if ("conditions" in condition) {
      issues.push(...findUnknownMatrixIds(condition, findMatrix, path));
      return;
    }
    const { leftOperand, rightOperand } = condition;
    if (leftOperand.type !== "element" || !isMatrixRowCondition(leftOperand.meta)) return;
    const matrix = findMatrix(leftOperand.value);
    if (!matrix) return;
    const where = `matrix question "${leftOperand.value}"`;

    const rowId = leftOperand.meta?.rowId;
    if (rowId !== undefined && indexOfId(matrix.rows, rowId) === undefined) {
      issues.push({
        path: [...path, "leftOperand", "meta", "rowId"],
        id: rowId,
        message: `Conditional Logic: Row id "${rowId}" does not exist in ${where}`,
      });
    }
    if (rightOperand?.type !== "static") return;
    const columnMessage = (id: string) => `Conditional Logic: Column id "${id}" does not exist in ${where}`;
    if (
      rightOperand.columnId !== undefined &&
      indexOfId(matrix.columns, rightOperand.columnId) === undefined
    ) {
      issues.push({
        path: [...path, "rightOperand", "columnId"],
        id: rightOperand.columnId,
        message: columnMessage(rightOperand.columnId),
      });
    }
    rightOperand.columnIds?.forEach((id, idIndex) => {
      if (indexOfId(matrix.columns, id) === undefined) {
        issues.push({
          path: [...path, "rightOperand", "columnIds", idIndex],
          id,
          message: columnMessage(id),
        });
      }
    });
  });
  return issues;
};
