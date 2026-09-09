import type { TActionClass, TActionClassInput } from "@formbricks/types/action-classes";
import type { TSurveyExportActionClassReference } from "@/app/api/v3/surveys/export/schemas";
import { importInfo, importWarning } from "../report";
import type { TImportIssue } from "../types";
import { isRecord } from "./paths";

const IMPORTED_SUFFIX = " (imported)";

export type TActionClassResolutionDeps = {
  listActionClasses: (workspaceId: string) => Promise<TActionClass[]>;
  createActionClass: (workspaceId: string, input: TActionClassInput) => Promise<{ id: string }>;
};

export type TActionClassResolutionParams = {
  document: Record<string, unknown>;
  references: readonly TSurveyExportActionClassReference[];
  workspaceId: string;
  dryRun: boolean;
  deps: TActionClassResolutionDeps;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Find the workspace action class an exported definition stands for: code actions by `key`, no-code
 * actions by a deep-equal `noCodeConfig`, otherwise by name. Same heuristic as "Copy to".
 */
export function matchActionClass(
  reference: TSurveyExportActionClassReference,
  existing: readonly TActionClass[]
): TActionClass | undefined {
  if (reference.type === "code" && reference.key) {
    const byKey = existing.find((candidate) => candidate.type === "code" && candidate.key === reference.key);
    if (byKey) return byKey;
  }

  if (reference.type === "noCode" && reference.noCodeConfig) {
    const wanted = stableStringify(reference.noCodeConfig);
    const byConfig = existing.find(
      (candidate) => candidate.type === "noCode" && stableStringify(candidate.noCodeConfig) === wanted
    );
    if (byConfig) return byConfig;
  }

  return existing.find((candidate) => candidate.name === reference.name && candidate.type === reference.type);
}

function uniqueName(name: string, takenNames: Set<string>): string {
  if (!takenNames.has(name)) return name;
  let candidate = `${name}${IMPORTED_SUFFIX}`;
  let counter = 2;
  while (takenNames.has(candidate)) {
    candidate = `${name}${IMPORTED_SUFFIX.slice(0, -1)} ${counter})`;
    counter += 1;
  }
  return candidate;
}

/**
 * Rewrite `distribution.triggers[].actionClassId` for the target workspace. Ids that already exist in
 * the workspace are kept as they are, which is what makes a second pass over a resolved document a
 * no-op. Link surveys lose `distribution` entirely (v3 rejects it on them).
 */
export async function resolveImportActionClasses({
  document,
  references,
  workspaceId,
  dryRun,
  deps,
}: TActionClassResolutionParams): Promise<TImportIssue[]> {
  const issues: TImportIssue[] = [];

  if (document.type !== "app") {
    if ("distribution" in document) {
      delete document.distribution;
      issues.push(
        importInfo({ code: "unknown_field_stripped", path: "distribution", vars: { field: "distribution" } })
      );
    }
    return issues;
  }

  const distribution = isRecord(document.distribution) ? document.distribution : null;
  const triggers = distribution && Array.isArray(distribution.triggers) ? distribution.triggers : [];
  if (!distribution || triggers.length === 0) {
    return issues;
  }

  const existing = await deps.listActionClasses(workspaceId);
  const existingById = new Map(existing.map((actionClass) => [actionClass.id, actionClass]));
  const takenNames = new Set(existing.map((actionClass) => actionClass.name));
  const resolvedBySourceId = new Map<string, string>();
  const kept: { actionClassId: string }[] = [];

  for (const [index, trigger] of triggers.entries()) {
    const path = `distribution.triggers.${index}.actionClassId`;
    const sourceId =
      isRecord(trigger) && typeof trigger.actionClassId === "string" ? trigger.actionClassId : null;
    if (!sourceId) {
      issues.push(importWarning({ code: "trigger_dropped", path, vars: { id: "?" } }));
      continue;
    }

    if (existingById.has(sourceId)) {
      kept.push({ actionClassId: sourceId });
      continue;
    }

    const alreadyResolved = resolvedBySourceId.get(sourceId);
    if (alreadyResolved) {
      kept.push({ actionClassId: alreadyResolved });
      continue;
    }

    const reference = references.find((candidate) => candidate.id === sourceId);
    if (!reference) {
      issues.push(importWarning({ code: "trigger_dropped", path, vars: { id: sourceId } }));
      continue;
    }

    const match = matchActionClass(reference, existing);
    if (match) {
      resolvedBySourceId.set(sourceId, match.id);
      kept.push({ actionClassId: match.id });
      issues.push(importInfo({ code: "trigger_mapped", path, vars: { name: reference.name } }));
      continue;
    }

    const name = uniqueName(reference.name, takenNames);
    if (dryRun) {
      issues.push(importInfo({ code: "trigger_would_be_created", path, vars: { name } }));
      kept.push({ actionClassId: sourceId });
      continue;
    }

    const created = await deps.createActionClass(workspaceId, {
      workspaceId,
      name,
      description: reference.description ?? undefined,
      ...(reference.type === "code"
        ? { type: "code" as const, key: reference.key }
        : { type: "noCode" as const, noCodeConfig: reference.noCodeConfig }),
    });
    takenNames.add(name);
    resolvedBySourceId.set(sourceId, created.id);
    kept.push({ actionClassId: created.id });
    issues.push(importInfo({ code: "trigger_created", path, vars: { name } }));
  }

  distribution.triggers = kept;
  return issues;
}
