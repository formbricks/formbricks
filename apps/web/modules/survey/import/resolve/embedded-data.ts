import { FORBIDDEN_IDS } from "@formbricks/types/surveys/validation";
import { importWarning } from "../report";
import type { TImportIssue } from "../types";
import { isRecord } from "./paths";

/**
 * Hidden field ids and variable names on import, aligned with the Embedded Data project (§8): names
 * must match `^[a-z][a-z0-9_]*$`, reserved names get a suffix instead of a 400 from the create call,
 * and every reference — logic operands, recall strings — follows the rename. One function for every
 * lane; the QSF mapper calls the same `normalizeFieldName`.
 *
 * TODO(embedded-data): when the Embedded Data manager lands, map QSF embedded data onto `ingested`
 * fields and Formbricks variables onto `computed` fields here instead of hidden fields and variables.
 */

const FORBIDDEN_LOWER = new Set(FORBIDDEN_IDS.map((id) => id.toLowerCase()));
const REFUSED_SUFFIX = "_imported";
export const FIELD_NAME_PATTERN = /^[a-z][a-z0-9_]*$/;

export type TFieldNameMapping = {
  source: string;
  fieldId: string;
  /** The name was reserved and had to be suffixed. */
  refused: boolean;
  /** The name changed in a way other than the reserved-name suffix. */
  renamed: boolean;
};

export function normalizeFieldName(source: string): TFieldNameMapping {
  let fieldId = source
    .trim()
    .toLowerCase()
    .replaceAll(/[^a-z0-9_]+/g, "_")
    .replaceAll(/_{2,}/g, "_")
    .replaceAll(/^_+|_+$/g, "");

  if (fieldId.length === 0) fieldId = "field";
  if (/^\d/.test(fieldId)) fieldId = `f_${fieldId}`;

  const refused = FORBIDDEN_LOWER.has(fieldId);
  if (refused) fieldId = `${fieldId}${REFUSED_SUFFIX}`;

  return { source, fieldId, refused, renamed: !refused && fieldId !== source };
}

/** Normalizes a list of names, keeping them distinct: a collision after normalization gets `_2`, `_3`, … */
function buildRenameMap(names: readonly string[], taken: Set<string>): Map<string, TFieldNameMapping> {
  const map = new Map<string, TFieldNameMapping>();
  for (const name of names) {
    if (map.has(name)) continue;
    const mapping = normalizeFieldName(name);
    let candidate = mapping.fieldId;
    let suffix = 2;
    while (taken.has(candidate)) {
      candidate = `${mapping.fieldId}_${suffix}`;
      suffix += 1;
    }
    taken.add(candidate);
    map.set(name, {
      ...mapping,
      fieldId: candidate,
      renamed: mapping.renamed || candidate !== mapping.fieldId,
    });
  }
  return map;
}

const RECALL_PATTERN = /#recall:([^/#]+)\/fallback:/g;

/** Rewrites `#recall:<id>/fallback:` occurrences and `{ type: "hiddenField", value }` operands through the map. */
function rewriteReferences(value: unknown, renames: ReadonlyMap<string, string>): unknown {
  if (typeof value === "string") {
    return value.includes("#recall:")
      ? value.replace(RECALL_PATTERN, (match, id: string) =>
          renames.has(id) ? `#recall:${renames.get(id)}/fallback:` : match
        )
      : value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => rewriteReferences(entry, renames));
  }
  if (isRecord(value)) {
    if (value.type === "hiddenField" && typeof value.value === "string" && renames.has(value.value)) {
      return { ...value, value: renames.get(value.value) };
    }
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) out[key] = rewriteReferences(nested, renames);
    return out;
  }
  return value;
}

function reportMapping(mapping: TFieldNameMapping, path: string, issues: TImportIssue[]): void {
  if (mapping.refused) {
    issues.push(
      importWarning({
        code: "embedded_data_name_refused",
        path,
        vars: { name: mapping.source, renamed: mapping.fieldId },
      })
    );
  } else if (mapping.renamed) {
    issues.push(
      importWarning({ code: "field_renamed", path, vars: { from: mapping.source, to: mapping.fieldId } })
    );
  }
}

/**
 * Mutates `document` in place: hidden field ids and variable names normalized, references rewritten.
 * Idempotent — a document whose names already follow the rules comes back untouched with no issues.
 */
export function normalizeImportedFieldNames(document: Record<string, unknown>): TImportIssue[] {
  const issues: TImportIssue[] = [];
  const taken = new Set<string>();

  const hiddenFields = isRecord(document.hiddenFields) ? document.hiddenFields : null;
  const fieldIds = hiddenFields && Array.isArray(hiddenFields.fieldIds) ? hiddenFields.fieldIds : [];
  const hiddenRenames = buildRenameMap(
    fieldIds.filter((id): id is string => typeof id === "string"),
    taken
  );
  const changedHidden = new Map<string, string>();
  for (const [source, mapping] of hiddenRenames) {
    if (mapping.fieldId !== source) changedHidden.set(source, mapping.fieldId);
    reportMapping(mapping, "hiddenFields.fieldIds", issues);
  }
  if (hiddenFields && changedHidden.size > 0) {
    hiddenFields.fieldIds = [
      ...new Set(
        fieldIds.map((id) => (typeof id === "string" ? (hiddenRenames.get(id)?.fieldId ?? id) : id))
      ),
    ];
  }

  const variables = Array.isArray(document.variables) ? document.variables : [];
  const variableNames = variables
    .filter(isRecord)
    .map((variable) => variable.name)
    .filter((name): name is string => typeof name === "string");
  const variableRenames = buildRenameMap(variableNames, taken);
  variables.forEach((variable, index) => {
    if (!isRecord(variable) || typeof variable.name !== "string") return;
    const mapping = variableRenames.get(variable.name);
    if (!mapping) return;
    reportMapping(mapping, `variables.${index}.name`, issues);
    variable.name = mapping.fieldId;
  });

  if (changedHidden.size > 0) {
    // Variables are referenced by id and need no rewrite; hidden fields are referenced by their id-name.
    for (const key of ["blocks", "endings", "welcomeCard", "metadata"] as const) {
      if (key in document) document[key] = rewriteReferences(document[key], changedHidden);
    }
  }

  return issues;
}
