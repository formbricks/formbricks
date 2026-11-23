import { MAX_EMBEDDED_KEY_LENGTH } from "@/modules/ee/analysis/lib/embedded-data-fields";
import { getEmbeddedMemberName } from "@/modules/ee/analysis/lib/embedded-member-name";
import {
  type TViewerAccessJoin,
  VIEWER_ACCESS_EMBEDDED_PREFIX,
  VIEWER_ACCESS_MAX_CONDITIONS,
  VIEWER_ACCESS_RECORD_FIELDS,
  getViewerAccessEmbeddedKey,
} from "./viewer-access-fields";

export {
  type TViewerAccessJoin,
  VIEWER_ACCESS_EMBEDDED_PREFIX,
  VIEWER_ACCESS_MAX_CONDITIONS,
  VIEWER_ACCESS_RECORD_FIELDS,
  getViewerAccessEmbeddedKey,
};

/**
 * Dashboard Viewer access as Cube enforces it (ADR-0061): a Feedback Dataset's conditions plus a viewer's
 * Member attribute values, compiled into the `viewerAccess` claim of the signed Cube token. Pure, so the
 * claim, its bounds and the summary the dashboard read returns are decided in one place.
 */

/** At most this many of a viewer's values per condition reach the claim. Mirrored in docker/cube/cube.js. */
export const VIEWER_ACCESS_MAX_VALUES = 50;
/** Longest value the claim carries. Mirrored in docker/cube/cube.js. */
export const VIEWER_ACCESS_MAX_VALUE_LENGTH = 255;

/** Whether a condition may name `field`: a listed record field, or `ed:<key>` with a usable key. */
export const isViewerAccessField = (field: string): boolean => {
  if (Object.hasOwn(VIEWER_ACCESS_RECORD_FIELDS, field)) return true;
  const key = getViewerAccessEmbeddedKey(field);
  return key !== null && key.trim().length > 0 && key.length <= MAX_EMBEDDED_KEY_LENGTH;
};

/** What people read for a condition field: the record field's label, or the embedded key as collected. */
export const getViewerAccessFieldLabel = (field: string): string =>
  VIEWER_ACCESS_RECORD_FIELDS[field] ?? getViewerAccessEmbeddedKey(field) ?? field;

/**
 * A viewer's values as the claim carries them: trimmed, blanks dropped, one per case-insensitive value,
 * none longer than the bound, at most `VIEWER_ACCESS_MAX_VALUES`.
 */
export const normalizeViewerAccessValues = (values: readonly string[]): string[] => {
  const seen = new Set<string>();
  const kept: string[] = [];
  for (const raw of values) {
    const value = raw.trim();
    if (!value || value.length > VIEWER_ACCESS_MAX_VALUE_LENGTH) continue;
    const folded = value.toLowerCase();
    if (seen.has(folded)) continue;
    seen.add(folded);
    kept.push(value);
    if (kept.length >= VIEWER_ACCESS_MAX_VALUES) break;
  }
  return kept;
};

export type TCubeViewerAccessClaim = {
  join: TViewerAccessJoin;
  /** `member` is a Cube member: a record field, or the compiled member of an embedded-data key. */
  conditions: { member: string; values: string[] }[];
};

export type TResolvedViewerCondition = {
  field: string;
  attributeKeyId: string | null;
  /** The Member attribute's label; "Email" for the built-in one. */
  attributeLabel: string;
  values: string[];
};

export type TResolvedViewerAccess = {
  join: TViewerAccessJoin;
  conditions: TResolvedViewerCondition[];
};

/**
 * The claim for one dataset, and the embedded keys it needs compiled into the token's `edKeys`. `null`
 * when the dataset has no conditions: no claim, every record.
 */
export const buildViewerAccessClaim = (
  access: TResolvedViewerAccess | null
): { claim: TCubeViewerAccessClaim; embeddedKeys: string[] } | null => {
  if (!access || access.conditions.length === 0) return null;
  const embeddedKeys: string[] = [];
  const conditions = access.conditions.slice(0, VIEWER_ACCESS_MAX_CONDITIONS).map(({ field, values }) => {
    const key = getViewerAccessEmbeddedKey(field);
    if (key !== null) embeddedKeys.push(key);
    return {
      member: key === null ? field : getEmbeddedMemberName(key),
      values: normalizeViewerAccessValues(values),
    };
  });
  return { claim: { join: access.join, conditions }, embeddedKeys: [...new Set(embeddedKeys)] };
};

/**
 * Whether the viewer matches nothing in the dataset whatever its records hold: with "all", one condition
 * without a value; with "any", every condition without one.
 */
export const isViewerAccessUnmatched = (access: TResolvedViewerAccess | null): boolean => {
  if (!access || access.conditions.length === 0) return false;
  const empty = access.conditions.map(({ values }) => normalizeViewerAccessValues(values).length === 0);
  return access.join === "all" ? empty.some(Boolean) : empty.every(Boolean);
};

export type TViewerAccessChip = { label: string; values: string[]; attributeLabel: string };

export type TViewerAccessSummary = {
  status: "unrestricted" | "restricted" | "unmatched";
  chips: TViewerAccessChip[];
};

export const UNRESTRICTED_VIEWER_ACCESS: TViewerAccessSummary = { status: "unrestricted", chips: [] };

/**
 * What a dashboard read tells its reader about the records they see: one locked chip per condition of
 * the datasets on the pages they can open ("any" conditions as one chip, labels joined with " or "), and
 * `unmatched` when a dataset leaves them nothing.
 */
export const summarizeViewerAccess = (
  datasets: readonly (TResolvedViewerAccess | null)[]
): TViewerAccessSummary => {
  const restricted = datasets.filter(
    (access): access is TResolvedViewerAccess => access !== null && access.conditions.length > 0
  );
  if (restricted.length === 0) return UNRESTRICTED_VIEWER_ACCESS;

  const chips = new Map<string, TViewerAccessChip>();
  const add = (chip: TViewerAccessChip) => {
    chips.set(JSON.stringify([chip.label, chip.attributeLabel, chip.values]), chip);
  };
  for (const access of restricted) {
    const conditions = access.conditions.map((condition) => ({
      label: getViewerAccessFieldLabel(condition.field),
      attributeLabel: condition.attributeLabel,
      values: normalizeViewerAccessValues(condition.values),
    }));
    if (access.join === "any" && conditions.length > 1) {
      add({
        label: conditions.map(({ label }) => label).join(" or "),
        attributeLabel: [...new Set(conditions.map(({ attributeLabel }) => attributeLabel))].join(" or "),
        values: normalizeViewerAccessValues(conditions.flatMap(({ values }) => values)),
      });
    } else {
      conditions.forEach(add);
    }
  }

  return {
    status: restricted.some(isViewerAccessUnmatched) ? "unmatched" : "restricted",
    chips: [...chips.values()],
  };
};
