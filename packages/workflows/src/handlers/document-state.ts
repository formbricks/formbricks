import type { TWorkflowResource } from "../contracts";
import type { TWorkflowDefinition } from "../types/document";

/**
 * The part of a workflow an agent edits as a document (ADR 0015): name, description and graph. Status,
 * the trigger survey's linkage (derived from the definition) and runs are not part of it.
 */
export interface WorkflowEditableState {
  name: string;
  description: string | null;
  definition: TWorkflowDefinition;
}

/**
 * What `pushDocument` answers when it is not a problem `Response`. `pushed` carries the resource as it was
 * and as it is now (or would be, for a dry run) and whether a row was written; a push that changes nothing
 * writes nothing. `stale` is the compare-and-set losing: the workflow changed since `expectedUpdatedAt`.
 */
export type WorkflowDocumentPushOutcome =
  | { kind: "pushed"; before: TWorkflowResource; after: TWorkflowResource; written: boolean }
  | { kind: "stale"; expectedUpdatedAt: string; currentUpdatedAt: string };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

/**
 * Deep equality for JSON values that ignores object key order. A definition read back from Postgres `jsonb`
 * has its keys reordered, so comparing `JSON.stringify` output would call an untouched definition changed.
 */
export const isSameJson = (left: unknown, right: unknown): boolean => {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((item, index) => isSameJson(item, right[index]))
    );
  }

  if (isRecord(left) && isRecord(right)) {
    const leftKeys = Object.keys(left).filter((key) => left[key] !== undefined);
    const rightKeys = Object.keys(right).filter((key) => right[key] !== undefined);
    return (
      leftKeys.length === rightKeys.length &&
      leftKeys.every((key) => key in right && isSameJson(left[key], right[key]))
    );
  }

  return left === right;
};
