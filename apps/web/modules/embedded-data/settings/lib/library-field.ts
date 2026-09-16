import { createId } from "@paralleldrive/cuid2";
import {
  type TEmbeddedData,
  type TEmbeddedDataDefaultValue,
  type TEmbeddedDataSource,
  type TEmbeddedDataType,
  ZEmbeddedData,
  ZEmbeddedDataSource,
  ZEmbeddedDataType,
} from "@formbricks/types/embedded-data";

/**
 * What the library field form may offer, and how a control's draft value maps onto a stored one.
 *
 * Everything here that looks like a rule is **asked of `ZEmbeddedData` rather than restated**: which
 * sources can be authored, which data types a source allows, and whether a source can be locked are
 * all answered by parsing a probe row through the same schema the service validates against
 * (`assertValidRow` in lib/library.ts). A component that hard-coded "computed means text or number"
 * would be a second copy of a rule that already exists, and the copy is the one that drifts when the
 * schema changes.
 */

/**
 * A row that differs from a valid one only in the columns under test.
 *
 * Real ids, because `ZEmbeddedData` checks them as cuid2 and a placeholder would make every probe
 * fail for the wrong reason. `probe_key` is deliberately not a reserved name — the key rule is a
 * different question from the ones asked here, and a reserved key would make every answer `false`.
 */
const PROBE_ROW: TEmbeddedData = {
  id: createId(),
  createdAt: new Date(0),
  updatedAt: new Date(0),
  key: "probe_key",
  name: "Probe",
  description: null,
  source: "ingested",
  dataType: "string",
  defaultValue: null,
  locked: false,
  surveyId: null,
  workspaceId: createId(),
};

/** Whether `ZEmbeddedData` accepts a row that differs from {@link PROBE_ROW} only by `patch`. */
const acceptsField = (patch: Partial<TEmbeddedData>): boolean =>
  ZEmbeddedData.safeParse({ ...PROBE_ROW, ...patch }).success;

/**
 * Display order for the source radios: the passed-in case is the common one, so it leads.
 *
 * Only the *order* is decided here — membership is not. A source the schema accepts but this list
 * does not name still appears, after the ones it does, so gaining one shows up unordered rather than
 * not at all. `reserved` never appears, because the schema refuses it: reserved fields are a code
 * catalog and never stored rows.
 */
const SOURCE_DISPLAY_PRIORITY: readonly TEmbeddedDataSource[] = ["ingested", "computed"];

const sourceDisplayRank = (source: TEmbeddedDataSource): number => {
  const rank = SOURCE_DISPLAY_PRIORITY.indexOf(source);
  return rank === -1 ? SOURCE_DISPLAY_PRIORITY.length : rank;
};

/** The sources an author may pick in the library form. */
export const getAuthorableSources = (): TEmbeddedDataSource[] =>
  ZEmbeddedDataSource.options
    .filter((source) => acceptsField({ source }))
    .sort((a, b) => sourceDisplayRank(a) - sourceDisplayRank(b));

/** The data types a source may take. Narrows to text and number for a calculated field. */
export const getDataTypesForSource = (source: TEmbeddedDataSource): TEmbeddedDataType[] =>
  ZEmbeddedDataType.options.filter((dataType) => acceptsField({ source, dataType }));

/** Whether a source's values can be locked against what arrives from outside. */
export const isLockableSource = (source: TEmbeddedDataSource): boolean =>
  acceptsField({ source, locked: true });

/**
 * The data type a form should fall back to when the current one is no longer offered — which happens
 * when the author switches a `date` or `boolean` field to `Calculated`.
 *
 * Keeping the current type when it is still allowed matters: switching source and back must not
 * silently retype the field.
 */
export const narrowDataTypeToSource = (
  dataType: TEmbeddedDataType,
  source: TEmbeddedDataSource
): TEmbeddedDataType => {
  const allowed = getDataTypesForSource(source);
  return allowed.includes(dataType) ? dataType : allowed[0];
};

/**
 * The stored default a form draft stands for.
 *
 * A blank draft is "no default", never `""` — an empty string is a value an ingested field would
 * then be filled with. A draft that cannot be read as the data type is forwarded **as the author
 * typed it** rather than dropped or rejected here: `ZEmbeddedData` is the one place that decides
 * whether a default agrees with its `dataType`, and forwarding lets it answer in its own words
 * instead of this function inventing a second message.
 */
export const parseDefaultValueDraft = (
  draft: string,
  dataType: TEmbeddedDataType
): TEmbeddedDataDefaultValue => {
  if (draft.trim() === "") return null;

  switch (dataType) {
    case "number": {
      const parsed = Number(draft);
      return Number.isFinite(parsed) ? parsed : draft;
    }
    case "boolean": {
      if (draft === "true") return true;
      if (draft === "false") return false;
      return draft;
    }
    // `date` defaults are stored as ISO 8601 strings, so the picker's value passes straight through.
    case "string":
    case "date":
      return draft;
  }
};

/** The inverse of {@link parseDefaultValueDraft}: what a control shows for a stored default. */
export const formatDefaultValueDraft = (defaultValue: TEmbeddedDataDefaultValue): string =>
  defaultValue === null ? "" : String(defaultValue);

/**
 * How the "Used in" cell reads, as a shape a component turns into copy.
 *
 * A descriptor rather than a translated string: `t()` calls have to be statically resolvable for the
 * key scanner, so the keys stay in the component and only the branch is decided here.
 */
export type TUsageLabel = { kind: "unused" } | { kind: "single" } | { kind: "multiple"; count: number };

export const getUsageLabel = (surveyCount: number): TUsageLabel => {
  if (surveyCount <= 0) return { kind: "unused" };
  if (surveyCount === 1) return { kind: "single" };
  return { kind: "multiple", count: surveyCount };
};
